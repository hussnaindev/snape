package com.snape.flix.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Client-side MovieBox source. Talks ONLY to the mobile BFF, directly from the
 * device (no proxy, no Cloudflare/Netlify) — the phone's residential IP is not
 * datacenter-blocked. Search is unfiltered (returns DMCA-delisted titles), and
 * each audio variant (Original / Hindi / Tamil …) comes back as its own item.
 */
object MovieBoxRepository {

    private const val BASE = "https://api.inmoviebox.com"
    private const val P_HOME = "/wefeed-mobile-bff/tab-operating"
    private const val P_SEARCH = "/wefeed-mobile-bff/subject-api/search"
    private const val P_SEASON = "/wefeed-mobile-bff/subject-api/season-info"
    private const val P_PLAY = "/wefeed-mobile-bff/subject-api/play-info"
    private const val P_RESOURCE = "/wefeed-mobile-bff/subject-api/resource"
    private const val P_CAPTIONS = "/wefeed-mobile-bff/subject-api/get-ext-captions"

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        // A signed-request rejection comes back as 407, which OkHttp would
        // otherwise turn into an opaque "while not using proxy" throw on a
        // direct route. Surface the BFF's own error payload instead so failures
        // are legible.
        .addNetworkInterceptor { chain ->
            val resp = chain.proceed(chain.request())
            if (resp.code >= 400) {
                val msg = runCatching { resp.peekBody(2048).string() }.getOrDefault("").take(200)
                resp.close()
                throw java.io.IOException("HTTP ${resp.code} $msg".trim())
            }
            resp
        }
        .build()

    // --- request builders ---------------------------------------------------

    private fun signedGet(path: String, params: List<Pair<String, String>>): Request {
        val ts = System.currentTimeMillis()
        val sortedQuery = params.sortedBy { it.first }.joinToString("&") { "${it.first}=${it.second}" }
        val query = params.joinToString("&") { "${it.first}=${it.second}" }
        val sig = MovieBoxSign.signature("GET", path, sortedQuery, null, ts)
        return Request.Builder()
            .url("$BASE$path?$query")
            .get()
            .applyCommonHeaders(ts, sig)
            .build()
    }

    private fun Request.Builder.applyCommonHeaders(ts: Long, sig: String): Request.Builder = this
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("Connection", "keep-alive")
        .header("User-Agent", MovieBoxSign.USER_AGENT)
        .header("X-Client-Info", MovieBoxSign.clientInfo())
        .header("X-Client-Status", "0")
        .header("X-Client-Token", MovieBoxSign.clientToken(ts))
        .header("x-tr-signature", sig)
        .header("X-Play-Mode", "2")

    private fun bodyString(req: Request): String =
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("HTTP ${resp.code}")
            resp.body?.string() ?: error("empty body")
        }

    // --- public API ---------------------------------------------------------

    /**
     * The MovieBox app home feed (`tab-operating`, tabId=0). Returns every row;
     * the caller keeps the SUBJECTS_MOVIE rows (the only ones with subjects) and
     * maps them onto the web app's curated sections. Subjects here carry a
     * populated `detailUrl` (unlike search hits) and `hasResource`.
     */
    suspend fun homeFeed(): List<HomeRow> = withContext(Dispatchers.IO) {
        val req = signedGet(
            P_HOME,
            listOf("tabId" to "0", "page" to "1", "version" to "3.0.03.0529.03"),
        )
        json.decodeFromString(TabOperatingResponse.serializer(), bodyString(req)).data?.items.orEmpty()
    }

    private const val PER_PAGE = 24

    /**
     * Raw, ungrouped search hits filtered to playable movies/series. This is the
     * matcher's input: a single TMDB title's audio variants are separate hits
     * here, and the matcher ([MovieBoxMatcher.pickVariants]) folds + orders them.
     * `hasResource == true` is enforced here (and again in the matcher) so an
     * un-streamable subject is never matched. Pulls one page by default (variants
     * are adjacent); [pages] > 1 widens the net for sparse hits.
     */
    suspend fun searchSubjects(keyword: String, pages: Int = 1): List<SubjectItem> = withContext(Dispatchers.IO) {
        val out = ArrayList<SubjectItem>()
        var page = 1
        while (page <= pages) {
            val (items, hasMore) = searchPage(keyword.trim(), page)
            out += items
            if (!hasMore) break
            page++
        }
        out
    }

    private fun searchPage(keyword: String, page: Int): Pair<List<SubjectItem>, Boolean> {
        val body = json.encodeToString(
            SearchRequest.serializer(),
            SearchRequest(keyword = keyword, page = page, perPage = PER_PAGE),
        )
        val ts = System.currentTimeMillis()
        val sig = MovieBoxSign.signature("POST", P_SEARCH, "", body, ts)
        val req = Request.Builder()
            .url("$BASE$P_SEARCH")
            // NOTE: send the body as bytes, not String. String.toRequestBody
            // appends "; charset=utf-8" to the Content-Type, but the signature
            // canonical signs a bare "application/json" — the mismatch makes the
            // BFF reject every request with 407 "Signature invalid". ByteArray's
            // toRequestBody uses the media type verbatim, so the sent header
            // matches what we signed.
            .post(body.toByteArray(Charsets.UTF_8).toRequestBody("application/json".toMediaType()))
            .applyCommonHeaders(ts, sig)
            .build()
        val parsed = json.decodeFromString(SearchResponse.serializer(), bodyString(req))
        val rawItems = parsed.data?.items ?: emptyList()
        val items = rawItems
            // Keep only playable movies/series (the flag is `hasResource`).
            .filter { (it.subjectType == 1 || it.subjectType == 2) && it.subjectId.isNotBlank() && it.hasResource }
        // Trust the pager when present; otherwise infer from a full page of raw hits.
        val hasMore = parsed.data?.pager?.hasMore ?: (rawItems.size >= PER_PAGE)
        return items to hasMore
    }

    // --- TMDB → MovieBox match (cached) -------------------------------------

    private data class CacheEntry(val group: SubjectGroup?, val expiresAt: Long)

    // Positive matches live for the session; negatives expire so newly-added
    // MovieBox titles eventually resolve. Bounded LRU keeps memory flat.
    private const val MATCH_CACHE_MAX = 256
    private const val NEG_TTL_MS = 10 * 60 * 1000L
    private val cache = object : LinkedHashMap<String, CacheEntry>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CacheEntry>?) = size > MATCH_CACHE_MAX
    }
    private val inFlight = HashMap<String, Deferred<SubjectGroup?>>()
    private val cacheMutex = Mutex()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private fun keyOf(ref: TmdbRef) = (if (ref.isSeries) "tv" else "movie") + ":" + ref.id

    /**
     * Resolve a TMDB ref to a playable MovieBox [SubjectGroup] (primary + ordered
     * audio variants), or null when no confident match exists. Cached and
     * in-flight-deduped, so opening the same title twice — or many cards for the
     * same title — costs at most one MovieBox search.
     */
    suspend fun resolve(ref: TmdbRef): SubjectGroup? {
        val key = keyOf(ref)
        val now = System.currentTimeMillis()
        val deferred: Deferred<SubjectGroup?> = cacheMutex.withLock {
            cache[key]?.let { e -> if (e.group != null || e.expiresAt > now) return e.group }
            inFlight[key] ?: scope.async { doResolve(ref).also { storeResult(key, it) } }
                .also { inFlight[key] = it }
        }
        return deferred.await()
    }

    private suspend fun storeResult(key: String, group: SubjectGroup?) = cacheMutex.withLock {
        cache[key] = CacheEntry(group, if (group == null) System.currentTimeMillis() + NEG_TTL_MS else Long.MAX_VALUE)
        inFlight.remove(key)
    }

    private suspend fun doResolve(ref: TmdbRef): SubjectGroup? {
        val items = runCatching { searchSubjects(ref.title) }.getOrDefault(emptyList())
        if (items.isEmpty()) return null
        val variants = MovieBoxMatcher.pickVariants(ref, items)
        if (variants.isEmpty()) return null
        // Stamp the TMDB id so the resolved subjects can be persisted and reopened.
        val stamped = variants.map { it.item.copy(tmdbId = ref.id) }
        return SubjectGroup(primary = stamped.first(), variants = stamped)
    }

    /** Seasons (with episode counts) for a series. */
    suspend fun seasonInfo(subjectId: String): List<SeasonItem> = withContext(Dispatchers.IO) {
        val req = signedGet(P_SEASON, listOf("subjectId" to subjectId))
        val parsed = json.decodeFromString(SeasonInfoResponse.serializer(), bodyString(req))
        parsed.data?.seasons.orEmpty().filter { it.maxEp > 0 }
    }

    /** Adaptive DASH stream + CloudFront cookie. Movies use se=0, ep=0. */
    suspend fun playInfo(subjectId: String, se: Int, ep: Int): Stream? = withContext(Dispatchers.IO) {
        val req = signedGet(
            P_PLAY,
            listOf("subjectId" to subjectId, "se" to se.toString(), "ep" to ep.toString()),
        )
        val parsed = json.decodeFromString(PlayInfoResponse.serializer(), bodyString(req))
        parsed.data?.streams?.firstOrNull { it.url.isNotBlank() }
    }

    /** Sideloadable subtitle tracks for the given episode (best-effort). */
    suspend fun captions(subjectId: String, se: Int, ep: Int): List<Caption> = withContext(Dispatchers.IO) {
        val resourceId = runCatching { resolveResourceId(subjectId, se, ep) }.getOrNull() ?: return@withContext emptyList()
        runCatching {
            val req = signedGet(P_CAPTIONS, listOf("subjectId" to subjectId, "resourceId" to resourceId))
            json.decodeFromString(CaptionsResponse.serializer(), bodyString(req)).data?.extCaptions.orEmpty()
                .filter { it.url.isNotBlank() }
        }.getOrDefault(emptyList())
    }

    /** Walk the (paginated) resource list to find a resourceId for this se/ep. */
    private fun resolveResourceId(subjectId: String, se: Int, ep: Int): String? {
        var page = 1
        repeat(6) {
            val req = signedGet(
                P_RESOURCE,
                listOf(
                    "subjectId" to subjectId,
                    "se" to se.toString(),
                    "ep" to ep.toString(),
                    "page" to page.toString(),
                    "perPage" to "20",
                ),
            )
            val data = json.decodeFromString(ResourceResponse.serializer(), bodyString(req)).data
            val list = data?.list.orEmpty()
            val hit = if (se == 0) list.firstOrNull() else list.firstOrNull { it.se == se && it.ep == ep }
            if (hit != null && hit.resourceId.isNotBlank()) return hit.resourceId
            if (data?.pager?.hasMore != true) return null
            page++
        }
        return null
    }
}
