package com.snape.flix.data

import android.app.Notification
import android.content.Context
import android.content.SharedPreferences
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.NotificationUtil
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.DatabaseProvider
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadHelper
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.offline.DownloadService
import com.snape.flix.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.IOException
import java.net.URI
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/** Where a download is in its lifecycle (mapped from Media3's [Download] states). */
enum class DownloadStatus { QUEUED, RUNNING, PAUSED, COMPLETED, FAILED, REMOVING }

/**
 * Card metadata carried alongside a Media3 download (serialized into the
 * [Download]'s opaque `data` blob) so the downloads list can render poster / logo
 * / chips without re-hitting TMDB, and so we can reopen the right stream.
 */
@Serializable
data class DownloadMeta(
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
    val subtitleLocalPath: String? = null,
)

/** A flattened, UI-facing view of one Media3 download (rebuilt on every change). */
data class DownloadItem(
    val id: String,
    val subjectId: String,
    val se: Int,
    val ep: Int,
    val title: String,
    val isSeries: Boolean,
    val posterUrl: String?,
    val logoUrl: String?,
    val year: String,
    val rating: Double?,
    val quality: String,
    val percent: Float, // 0..100
    val bytesDownloaded: Long,
    val contentLength: Long, // -1 until known (adaptive)
    val status: DownloadStatus,
    val retryCount: Int = 0,
) {
    val fraction: Float get() = (percent / 100f).coerceIn(0f, 1f)
    val inProgress: Boolean get() = status != DownloadStatus.COMPLETED
    val episodeLabel: String get() = if (isSeries) "S$se · E$ep" else ""
}

/**
 * Offline downloads, built on Media3's offline download stack so **every** stream
 * format works — progressive MP4, adaptive DASH, and HLS alike. Media3 parses the
 * manifest, downloads the segments into a [SimpleCache], and the offline player
 * reads them back through a [CacheDataSource] (no network). Persistence, resume
 * after a restart, and progress accounting are handled by Media3's download index.
 *
 *  • Per-download CloudFront `Cookie`s are injected for the manifest AND every
 *    segment request via a [ResolvingDataSource] keyed by URL host.
 *  • [SnapeDownloadService] is the foreground service that keeps downloads running.
 *  • On process restart we pause any still-active downloads (so nothing silently
 *    resumes) — the user resumes them from the downloads page.
 *
 * [init] must be called once from [com.snape.flix.SnapeApp.onCreate].
 */
@OptIn(UnstableApi::class)
object Downloads {

    const val CHANNEL_ID = "downloads"
    private const val PREFS = "snape_downloads"
    private const val KEY_COOKIES = "cookies_v1"
    // Any non-zero stop reason marks a download as user-paused.
    private const val STOP_REASON_PAUSE = 1

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    // Off-main work: re-resolving a fresh signed stream when resuming a download.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private lateinit var appContext: Context
    private lateinit var prefs: SharedPreferences

    private var cache: Cache? = null
    private var dbProvider: DatabaseProvider? = null
    @Volatile private var manager: DownloadManager? = null
    private var notificationHelper: DownloadNotificationHelper? = null

    // host -> CloudFront Cookie. Applied to the manifest and all of its segments.
    private val cookieByHost = ConcurrentHashMap<String, String>()

    private val _items = MutableStateFlow<List<DownloadItem>>(emptyList())
    val items: StateFlow<List<DownloadItem>> = _items.asStateFlow()

    private val _removingIds = MutableStateFlow<Set<String>>(emptySet())
    val removingIds: StateFlow<Set<String>> = _removingIds.asStateFlow()

    private val _resumingIds = MutableStateFlow<Set<String>>(emptySet())
    val resumingIds: StateFlow<Set<String>> = _resumingIds.asStateFlow()

    // Retry tracking — incremental delays for failed downloads.
    private val retryCounts = ConcurrentHashMap<String, Int>()
    private val _scheduledRetries = MutableStateFlow<Set<String>>(emptySet())
    val scheduledRetries: StateFlow<Set<String>> = _scheduledRetries.asStateFlow()

    companion object {
        val RETRY_DELAYS = listOf(1_000L, 3_000L, 5_000L, 10_000L, 15_000L)
    }

    fun init(context: Context) {
        appContext = context.applicationContext
        prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        loadCookies()
        NotificationUtil.createNotificationChannel(
            appContext,
            CHANNEL_ID,
            R.string.download_channel_name,
            0,
            NotificationUtil.IMPORTANCE_LOW,
        )
        val dm = downloadManager(appContext)
        // Don't silently resume after a cold start — present them as paused.
        dm.setStopReason(null, STOP_REASON_PAUSE)
        refresh()
        // Media3 only notifies on state *changes*, not on byte progress. Poll rapidly
        // (~60 fps) while anything is actively downloading so the UI progress bar and
        // size labels update in real time.
        scope.launch {
            while (true) {
                val active = _items.value.any { it.status == DownloadStatus.RUNNING || it.status == DownloadStatus.REMOVING }
                if (active) refresh()
                // Retry failed downloads when idle
                if (!active) {
                    _items.value.filter { it.status == DownloadStatus.FAILED }.forEach { item ->
                        val count = retryCounts.getOrDefault(item.id, 0)
                        if (count < RETRY_DELAYS.size && item.id !in _scheduledRetries.value) {
                            scheduleRetry(item.id, count)
                        }
                    }
                }
                delay(if (active) 50 else 1000)
            }
        }
    }

    // --- Media3 singletons --------------------------------------------------

    @Synchronized
    fun downloadManager(context: Context): DownloadManager {
        manager?.let { return it }
        val ctx = context.applicationContext
        val db = StandaloneDatabaseProvider(ctx).also { dbProvider = it }
        val c = SimpleCache(downloadDir(ctx), NoOpCacheEvictor(), db).also { cache = it }
        val dm = DownloadManager(ctx, db, c, upstreamFactory(), Executors.newFixedThreadPool(3)).apply {
            maxParallelDownloads = 2
            addListener(object : DownloadManager.Listener {
                override fun onInitialized(downloadManager: DownloadManager) = refresh()
                override fun onDownloadChanged(downloadManager: DownloadManager, download: Download, finalException: Exception?) = refresh()
                override fun onDownloadRemoved(downloadManager: DownloadManager, download: Download) = refresh()
                override fun onIdle(downloadManager: DownloadManager) = refresh()
            })
        }
        manager = dm
        return dm
    }

    /** Cache-backed (read-through) factory for offline playback of finished items. */
    fun playbackFactory(context: Context): DataSource.Factory {
        downloadManager(context) // ensure the cache exists
        return CacheDataSource.Factory()
            .setCache(cache!!)
            .setUpstreamDataSourceFactory(upstreamFactory())
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    /** The stored [MediaItem] (uri + mime + stream keys) for offline playback. */
    fun mediaItem(id: String): MediaItem? = downloadById(id)?.request?.toMediaItem()

    private fun upstreamFactory(): DataSource.Factory {
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(MovieBoxSign.USER_AGENT)
            .setAllowCrossProtocolRedirects(true)
        return ResolvingDataSource.Factory(http) { dataSpec ->
            val cookie = dataSpec.uri.host?.let { cookieByHost[it] }
            if (!cookie.isNullOrBlank()) dataSpec.withAdditionalHeaders(mapOf("Cookie" to cookie)) else dataSpec
        }
    }

    // --- public API ---------------------------------------------------------

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
        format: String,
        subtitleUrl: String? = null,
    ) {
        val ctx = appContext
        rememberCookie(url, signCookie)
        downloadManager(ctx) // ensure ready
        val id = "$subjectId/$se/$ep"

        // Fetch subtitle blob BEFORE video download — the signed URL may expire
        // during the multi-minute manifest probe and segment download.
        scope.launch {
            val subtitleLocalPath = subtitleUrl?.takeUnless { it.isBlank() }?.let { subUrl ->
                runCatching {
                    val bytes = URL(subUrl).readBytes()
                    val subFile = File(downloadDir(ctx), "${id}_sub.srt")
                    subFile.writeBytes(bytes)
                    subFile.absolutePath
                }.getOrNull()
            }

            withContext(Dispatchers.Main) {
                val mime = when (format.uppercase()) {
                    "HLS" -> MimeTypes.APPLICATION_M3U8
                    "MP4" -> MimeTypes.VIDEO_MP4
                    "DASH" -> MimeTypes.APPLICATION_MPD
                    else -> null
                }
                val meta = DownloadMeta(subjectId, se, ep, title, isSeries, posterUrl, logoUrl, year, rating, quality, subtitleLocalPath = subtitleLocalPath)
                val data = json.encodeToString(DownloadMeta.serializer(), meta).toByteArray()
                val mediaItem = MediaItem.Builder().setUri(url)
                    .apply { if (mime != null) setMimeType(mime) }
                    .build()

                // Probe the manifest, pick the chosen quality, then queue.
                val helper = DownloadHelper.forMediaItem(ctx, mediaItem, DefaultRenderersFactory(ctx), upstreamFactory())
                helper.prepare(object : DownloadHelper.Callback {
                    override fun onPrepared(helper: DownloadHelper) {
                        try {
                            quality.removeSuffix("p").toIntOrNull()?.let { targetHeight ->
                                val params = DownloadHelper.getDefaultTrackSelectorParameters(ctx).buildUpon()
                                    .setMaxVideoSize(Int.MAX_VALUE, targetHeight)
                                    .build()
                                for (period in 0 until helper.periodCount) {
                                    helper.clearTrackSelections(period)
                                    helper.addTrackSelection(period, params)
                                }
                            }
                            val request = helper.getDownloadRequest(id, data)
                            DownloadService.sendAddDownload(ctx, SnapeDownloadService::class.java, request, /* foreground = */ false)
                        } finally {
                            helper.release()
                        }
                    }

                    override fun onPrepareError(helper: DownloadHelper, e: IOException) {
                        helper.release()
                    }
                })
            }
        }
    }

    fun pause(id: String) {
        DownloadService.sendSetStopReason(appContext, SnapeDownloadService::class.java, id, STOP_REASON_PAUSE, false)
    }

    /**
     * Resume a paused/failed download. CloudFront signed cookies are time-limited,
     * so a download resumed long after a restart would 403 with its stale cookie.
     * Because MovieBox authorizes by *cookie* (the manifest/segment URLs are stable),
     * we re-resolve play-info to mint a fresh cookie for the host, then resume —
     * already-cached segments are reused and the rest download with the new cookie.
     * Re-resolution is best-effort: if it fails (offline), we resume with what we have.
     */
    fun resume(id: String) {
        val download = downloadById(id) ?: return
        val meta = runCatching { json.decodeFromString(DownloadMeta.serializer(), String(download.request.data)) }.getOrNull()
        // Immediately mark as resuming so the UI shows a loading spinner.
        _resumingIds.value = _resumingIds.value + id
        refresh()
        scope.launch {
            if (meta != null) {
                runCatching { MovieBoxRepository.playInfo(meta.subjectId, meta.se, meta.ep) }
                    .getOrNull()
                    ?.takeIf { it.url.isNotBlank() && it.signCookie.isNotBlank() }
                    ?.let { fresh -> rememberCookie(fresh.url, fresh.signCookie) }
            }
            if (download.state == Download.STATE_FAILED) {
                DownloadService.sendAddDownload(appContext, SnapeDownloadService::class.java, download.request, false)
            } else {
                DownloadService.sendSetStopReason(appContext, SnapeDownloadService::class.java, id, Download.STOP_REASON_NONE, false)
            }
            _resumingIds.value = _resumingIds.value - id
        }
    }

    fun cancel(id: String) {
        // Immediately mark as removing so the UI shows "Deleting…" + spinner.
        _removingIds.value = _removingIds.value + id
        refresh()
        // After the remove completes (onDownloadRemoved → refresh) the item will
        // disappear from the list, which is how the UI knows to stop rendering it.
        DownloadService.sendRemoveDownload(appContext, SnapeDownloadService::class.java, id, false)
    }

    /**
     * Schedule an automatic retry for a failed download after an incremental delay.
     * Each failed download gets up to 5 retries with delays: 1s, 3s, 5s, 10s, 15s.
     * Before retrying, we refresh the CloudFront cookie (best-effort) since the
     * original signed cookie may have expired.
     */
    private fun scheduleRetry(id: String, count: Int) {
        _scheduledRetries.value = _scheduledRetries.value + id
        scope.launch {
            delay(RETRY_DELAYS[count])
            _scheduledRetries.value = _scheduledRetries.value - id
            val download = downloadById(id) ?: return@launch
            if (download.state == Download.STATE_FAILED) {
                retryCounts[id] = count + 1
                val meta = runCatching { json.decodeFromString(DownloadMeta.serializer(), String(download.request.data)) }.getOrNull()
                if (meta != null) {
                    runCatching { MovieBoxRepository.playInfo(meta.subjectId, meta.se, meta.ep) }
                        .getOrNull()
                        ?.takeIf { it.url.isNotBlank() && it.signCookie.isNotBlank() }
                        ?.let { fresh -> rememberCookie(fresh.url, fresh.signCookie) }
                }
                DownloadService.sendAddDownload(appContext, SnapeDownloadService::class.java, download.request, false)
            }
        }
    }

    // --- foreground notification (called by the service) --------------------

    fun buildForegroundNotification(context: Context, downloads: List<Download>, notMetRequirements: Int): Notification {
        val helper = notificationHelper
            ?: DownloadNotificationHelper(context, CHANNEL_ID).also { notificationHelper = it }
        return helper.buildProgressNotification(
            context,
            android.R.drawable.stat_sys_download,
            /* contentIntent = */ null,
            /* message = */ null,
            downloads,
            notMetRequirements,
        )
    }

    // --- internals ----------------------------------------------------------

    private fun downloadDir(context: Context): File =
        File(context.getExternalFilesDir(null), "downloads").apply { mkdirs() }

    private fun downloadById(id: String): Download? =
        runCatching { manager?.downloadIndex?.getDownload(id) }.getOrNull()

    /** Public re-read of the download index into [items] — backs pull-to-refresh. */
    fun reload() = refresh()

    private fun refresh() {
        val dm = manager ?: return
        val list = runCatching {
            // The index DB only flushes progress every few seconds, so reading it
            // makes the progress bar jump in 4–5s chunks. The DownloadManager keeps
            // live, continuously-updated [Download] objects in memory for everything
            // that isn't terminal (queued/downloading/removing) — prefer those for an
            // accurate, real-time percent and fall back to the index for the rest
            // (completed/failed items aren't in currentDownloads).
            val live = dm.currentDownloads.associateBy { it.request.id }
            val acc = mutableListOf<DownloadItem>()
            dm.downloadIndex.getDownloads().use { cursor ->
                while (cursor.moveToNext()) {
                    val indexed = cursor.download
                    acc += (live[indexed.request.id] ?: indexed).toItem()
                }
            }
            acc
        }.getOrNull() ?: return
        _items.value = list
    }

    private fun Download.toItem(): DownloadItem {
        val meta = runCatching { json.decodeFromString(DownloadMeta.serializer(), String(request.data)) }.getOrNull()
        val pct = percentDownloaded.takeIf { it in 0f..100f } ?: 0f
        return DownloadItem(
            id = request.id,
            subjectId = meta?.subjectId ?: "",
            se = meta?.se ?: 0,
            ep = meta?.ep ?: 0,
            title = meta?.title ?: request.id,
            isSeries = meta?.isSeries ?: false,
            posterUrl = meta?.posterUrl,
            logoUrl = meta?.logoUrl,
            year = meta?.year ?: "",
            rating = meta?.rating,
            quality = meta?.quality ?: "",
            percent = pct,
            bytesDownloaded = bytesDownloaded,
            contentLength = contentLength,
            status = mapState(state, stopReason),
            retryCount = retryCounts[request.id] ?: 0,
        )
    }

    private fun mapState(state: Int, stopReason: Int): DownloadStatus = when (state) {
        Download.STATE_COMPLETED -> DownloadStatus.COMPLETED
        Download.STATE_DOWNLOADING, Download.STATE_RESTARTING -> DownloadStatus.RUNNING
        Download.STATE_REMOVING -> DownloadStatus.REMOVING
        Download.STATE_STOPPED -> DownloadStatus.PAUSED
        Download.STATE_FAILED -> DownloadStatus.FAILED
        Download.STATE_QUEUED -> if (stopReason != Download.STOP_REASON_NONE) DownloadStatus.PAUSED else DownloadStatus.QUEUED
        else -> DownloadStatus.QUEUED
    }

    // --- cookie persistence (best-effort; signed cookies are time-limited) ---

    private fun rememberCookie(url: String, cookie: String) {
        if (cookie.isBlank()) return
        val host = runCatching { URI(url).host }.getOrNull() ?: return
        cookieByHost[host] = cookie
        runCatching { prefs.edit().putString(KEY_COOKIES, json.encodeToString(cookieByHost.toMap())).apply() }
    }

    private fun loadCookies() {
        val raw = prefs.getString(KEY_COOKIES, null) ?: return
        runCatching { json.decodeFromString<Map<String, String>>(raw) }.getOrNull()?.let { cookieByHost.putAll(it) }
    }
}
