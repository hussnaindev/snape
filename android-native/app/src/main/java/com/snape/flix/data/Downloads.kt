package com.snape.flix.data

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.cancellation.CancellationException

/** Where a download is in its lifecycle. */
@Serializable
enum class DownloadStatus { QUEUED, RUNNING, PAUSED, COMPLETED }

/**
 * One offline download. Carries enough card metadata (poster/logo/year/rating) to
 * render the downloads list without re-hitting TMDB, plus the resolved signed
 * stream URL so a paused/interrupted download can resume via an HTTP Range request.
 */
@Serializable
data class DownloadItem(
    val id: String, // "$subjectId/$se/$ep" — one row per movie/episode
    val subjectId: String,
    val se: Int,
    val ep: Int,
    val title: String,
    val isSeries: Boolean,
    val posterUrl: String? = null,
    val logoUrl: String? = null,
    val year: String = "",
    val rating: Double? = null,
    val quality: String = "",
    val url: String,
    val signCookie: String = "",
    val fileName: String,
    val bytesDownloaded: Long = 0,
    val totalBytes: Long = 0,
    val status: DownloadStatus = DownloadStatus.QUEUED,
) {
    /** 0f‥1f downloaded fraction for the progress ring (0 until size is known). */
    val fraction: Float
        get() = if (totalBytes > 0) (bytesDownloaded.toFloat() / totalBytes).coerceIn(0f, 1f) else 0f

    /** Still on the way down (shown on the home indicator + the active section). */
    val inProgress: Boolean
        get() = status != DownloadStatus.COMPLETED

    /** Episode label suffix, e.g. "S1 · E2" (blank for movies). */
    val episodeLabel: String get() = if (isSeries) "S$se · E$ep" else ""
}

/**
 * On-device download manager — NO external service, NO Android DownloadManager.
 * Streams the signed MovieBox URL to the app's external files dir over OkHttp with
 * our own progress accounting so the UI can render a precise ring + pause/resume.
 *
 *  • Runs on an application-scoped coroutine scope, so a download keeps going while
 *    the user navigates between screens (background "as long as the app is open").
 *  • State is persisted to [SharedPreferences] as JSON. If the process is killed
 *    mid-download, [init] flips any RUNNING/QUEUED row back to PAUSED so the user
 *    can resume it on next launch (we never silently keep downloading once closed).
 *  • Resume re-issues the request with `Range: bytes=<partial>-` and appends to the
 *    partial file; servers that ignore the range (200 instead of 206) restart clean.
 *
 * [init] must be called once from [com.snape.flix.SnapeApp.onCreate].
 */
object Downloads {

    private const val PREFS = "snape_downloads"
    private const val KEY = "downloads_v1"

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private lateinit var prefs: SharedPreferences
    private lateinit var appContext: Context

    // Application-scoped: survives Activity teardown so downloads continue while the
    // app is alive. Dies with the process (→ partial files resume as PAUSED).
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val jobs = ConcurrentHashMap<String, Job>()

    // Long read timeout (big files); no call timeout so a slow download isn't aborted.
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val _items = MutableStateFlow<List<DownloadItem>>(emptyList())
    val items: StateFlow<List<DownloadItem>> = _items.asStateFlow()

    fun init(context: Context) {
        appContext = context.applicationContext
        prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // A RUNNING/QUEUED row can only be stale here (the process just started), so
        // present it as PAUSED — resumable, never silently resumed.
        _items.value = decode().map {
            if (it.status == DownloadStatus.RUNNING || it.status == DownloadStatus.QUEUED) {
                it.copy(status = DownloadStatus.PAUSED)
            } else {
                it
            }
        }
        persist()
    }

    // --- public API ---------------------------------------------------------

    /** Begin (or restart) a download for the chosen variant/episode. */
    fun enqueue(
        subjectId: String,
        se: Int,
        ep: Int,
        title: String,
        isSeries: Boolean,
        posterUrl: String?,
        logoUrl: String?,
        year: String,
        rating: Double?,
        quality: String,
        url: String,
        signCookie: String,
    ) {
        val id = "$subjectId/$se/$ep"
        val safeBase = title.replace(Regex("[^A-Za-z0-9 ._-]"), "").trim().ifBlank { "video" }
        val fileName = (if (isSeries) "$safeBase S${se}E$ep" else safeBase) + ".mp4"
        // Fresh start: drop any stale partial file for this id.
        fileFor(fileName).delete()
        val item = DownloadItem(
            id = id,
            subjectId = subjectId,
            se = se,
            ep = ep,
            title = title,
            isSeries = isSeries,
            posterUrl = posterUrl,
            logoUrl = logoUrl,
            year = year,
            rating = rating,
            quality = quality,
            url = url,
            signCookie = signCookie,
            fileName = fileName,
            status = DownloadStatus.QUEUED,
        )
        _items.update { list -> listOf(item) + list.filterNot { it.id == id } }
        persist()
        start(id)
    }

    fun pause(id: String) {
        jobs.remove(id)?.cancel()
        update(id) { if (it.status == DownloadStatus.RUNNING || it.status == DownloadStatus.QUEUED) it.copy(status = DownloadStatus.PAUSED) else it }
        persist()
    }

    fun resume(id: String) {
        val item = current(id) ?: return
        if (item.status == DownloadStatus.RUNNING || item.status == DownloadStatus.COMPLETED) return
        start(id)
    }

    fun cancel(id: String) {
        jobs.remove(id)?.cancel()
        current(id)?.let { fileFor(it.fileName).delete() }
        _items.update { list -> list.filterNot { it.id == id } }
        persist()
    }

    /** Absolute path of a completed download's file (for offline playback). */
    fun filePath(id: String): String? =
        current(id)?.let { fileFor(it.fileName) }?.takeIf { it.exists() }?.absolutePath

    // --- engine -------------------------------------------------------------

    private fun start(id: String) {
        jobs.remove(id)?.cancel()
        jobs[id] = scope.launch { runDownload(id) }
    }

    private suspend fun runDownload(id: String) {
        update(id) { it.copy(status = DownloadStatus.RUNNING) }
        val item = current(id) ?: return
        val file = fileFor(item.fileName)
        val existing = if (file.exists()) file.length() else 0L

        val builder = Request.Builder()
            .url(item.url)
            .header("User-Agent", MovieBoxSign.USER_AGENT)
        if (item.signCookie.isNotBlank()) builder.header("Cookie", item.signCookie)
        if (existing > 0) builder.header("Range", "bytes=$existing-")

        try {
            client.newCall(builder.build()).execute().use { resp ->
                val partial = resp.code == 206
                if (!resp.isSuccessful) throw IOException("HTTP ${resp.code}")
                val body = resp.body ?: throw IOException("empty body")
                val remaining = body.contentLength()
                // 206 → contentLength is the remaining tail; 200 → it's the whole file.
                val total = when {
                    partial && remaining > 0 -> existing + remaining
                    remaining > 0 -> remaining
                    else -> 0L
                }
                val append = partial && existing > 0
                var downloaded = if (append) existing else 0L
                update(id) { it.copy(totalBytes = total, bytesDownloaded = downloaded) }

                FileOutputStream(file, append).use { os ->
                    body.byteStream().use { ins ->
                        val buf = ByteArray(64 * 1024)
                        var lastUi = 0L
                        var lastDisk = 0L
                        while (true) {
                            // Checks THIS download's coroutine (not the parent scope),
                            // so pause()/cancel() breaks the loop cleanly.
                            currentCoroutineContext().ensureActive()
                            val n = ins.read(buf)
                            if (n < 0) break
                            os.write(buf, 0, n)
                            downloaded += n
                            val now = SystemClock.elapsedRealtime()
                            if (now - lastUi >= 150) {
                                update(id) { it.copy(bytesDownloaded = downloaded) }
                                lastUi = now
                            }
                            if (now - lastDisk >= 1500) {
                                update(id) { it.copy(bytesDownloaded = downloaded) }
                                persist()
                                lastDisk = now
                            }
                        }
                    }
                }
                update(id) {
                    val size = if (it.totalBytes > 0) it.totalBytes else file.length()
                    it.copy(status = DownloadStatus.COMPLETED, bytesDownloaded = size, totalBytes = size)
                }
                persist()
            }
        } catch (ce: CancellationException) {
            // Paused/cancelled: bytes already on disk, status set by pause()/cancel().
            update(id) { it.copy(bytesDownloaded = file.length()) }
            persist()
            throw ce
        } catch (_: Exception) {
            // Network/IO failure: keep the partial file and let the user resume.
            update(id) { if (it.status == DownloadStatus.RUNNING) it.copy(status = DownloadStatus.PAUSED, bytesDownloaded = file.length()) else it }
            persist()
        } finally {
            jobs.remove(id)
        }
    }

    // --- io -----------------------------------------------------------------

    private fun dir(): File = File(appContext.getExternalFilesDir(null), "downloads").apply { mkdirs() }
    private fun fileFor(fileName: String): File = File(dir(), fileName)

    private fun current(id: String): DownloadItem? = _items.value.firstOrNull { it.id == id }

    private inline fun update(id: String, crossinline fn: (DownloadItem) -> DownloadItem) {
        _items.update { list -> list.map { if (it.id == id) fn(it) else it } }
    }

    private fun decode(): List<DownloadItem> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { json.decodeFromString(ListSerializer(DownloadItem.serializer()), raw) }
            .getOrDefault(emptyList())
    }

    private fun persist() {
        val raw = runCatching { json.encodeToString(ListSerializer(DownloadItem.serializer()), _items.value) }.getOrNull()
        prefs.edit().apply { if (raw != null) putString(KEY, raw) else remove(KEY) }.apply()
    }
}
