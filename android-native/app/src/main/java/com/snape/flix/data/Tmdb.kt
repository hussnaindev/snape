package com.snape.flix.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Native TMDB client. The native app is fully independent of the web backend —
 * MovieBox supplies the playable catalogue (titles, posters, streams) and TMDB
 * fills in the richer detail-page metadata the web app shows but MovieBox lacks:
 * backdrop, title logo, trailer, cast, genres, season/episode stills and
 * "more like this" recommendations.
 *
 * Calls go straight to api.themoviedb.org from the device with the v3 API key
 * (the same key the web app uses server-side).
 */
object TmdbRepository {

    private const val KEY = "cb3f1967870c3b4bccc77e56facb5931"
    private const val BASE = "https://api.themoviedb.org/3"
    private const val IMG = "https://image.tmdb.org/t/p"

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
        .build()

    /** Build a full TMDB image URL, or null when the path is absent. */
    fun img(path: String?, size: String): String? =
        if (path.isNullOrBlank()) null else "$IMG/$size$path"

    private fun <T> get(
        path: String,
        params: List<Pair<String, String>> = emptyList(),
        serializer: kotlinx.serialization.KSerializer<T>,
    ): T {
        val query = buildList {
            add("api_key" to KEY)
            addAll(params)
        }.joinToString("&") { (k, v) -> "$k=${enc(v)}" }
        val req = Request.Builder().url("$BASE$path?$query").get().build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("TMDB ${resp.code}")
            val body = resp.body?.string() ?: error("empty body")
            return json.decodeFromString(serializer, body)
        }
    }

    private fun enc(s: String): String =
        java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    /** Strip a trailing "[Hindi]"/"[Tamil]" audio tag so it matches TMDB titles. */
    private fun cleanTitle(title: String): String =
        title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim()

    // --- public API ---------------------------------------------------------

    /** Resolve a MovieBox title+year to its TMDB id (best year match wins). */
    suspend fun resolveId(isSeries: Boolean, title: String, year: String): Int? =
        withContext(Dispatchers.IO) {
            runCatching {
                val q = cleanTitle(title)
                if (q.isBlank()) return@runCatching null
                val path = if (isSeries) "/search/tv" else "/search/movie"
                val params = buildList {
                    add("query" to q)
                    add("include_adult" to "false")
                    if (year.length >= 4) {
                        add((if (isSeries) "first_air_date_year" else "year") to year.take(4))
                    }
                }
                val hits = get(path, params, TmdbSearchResponse.serializer()).results
                if (hits.isEmpty()) return@runCatching null
                val y = year.take(4)
                val byYear = hits.firstOrNull {
                    (if (isSeries) it.first_air_date else it.release_date).take(4) == y
                }
                (byYear ?: hits.first()).id
            }.getOrNull()
        }

    suspend fun detail(isSeries: Boolean, id: Int): TmdbDetail? = withContext(Dispatchers.IO) {
        runCatching {
            get(if (isSeries) "/tv/$id" else "/movie/$id", emptyList(), TmdbDetail.serializer())
        }.getOrNull()
    }

    suspend fun cast(isSeries: Boolean, id: Int): List<TmdbCastMember> = withContext(Dispatchers.IO) {
        runCatching {
            get(
                if (isSeries) "/tv/$id/credits" else "/movie/$id/credits",
                emptyList(),
                TmdbCreditsResponse.serializer(),
            ).cast
        }.getOrDefault(emptyList())
    }

    /** English-or-language-neutral title logo, like the web detail page picks. */
    suspend fun logoUrl(isSeries: Boolean, id: Int): String? = withContext(Dispatchers.IO) {
        runCatching {
            val res = get(
                if (isSeries) "/tv/$id/images" else "/movie/$id/images",
                listOf("include_image_language" to "en,null"),
                TmdbImagesResponse.serializer(),
            )
            val path = res.logos.firstOrNull { it.iso_639_1 == "en" }?.file_path
                ?: res.logos.firstOrNull()?.file_path
            img(path, "w500")
        }.getOrNull()
    }

    /** First embeddable YouTube trailer/teaser key (official trailers first). */
    suspend fun trailerKey(isSeries: Boolean, id: Int): String? = withContext(Dispatchers.IO) {
        runCatching {
            val vids = get(
                if (isSeries) "/tv/$id/videos" else "/movie/$id/videos",
                emptyList(),
                TmdbVideosResponse.serializer(),
            ).results
            vids.filter { it.site == "YouTube" && (it.type == "Trailer" || it.type == "Teaser") }
                .sortedWith(
                    compareByDescending<TmdbVideo> { it.official }
                        .thenByDescending { it.type == "Trailer" },
                )
                .firstOrNull()
                ?.key
        }.getOrNull()
    }

    /** "More like this" via discover by genre (matches the web detail page). */
    suspend fun recommendations(
        isSeries: Boolean,
        id: Int,
        genreIds: List<Int>,
    ): List<TmdbSearchHit> = withContext(Dispatchers.IO) {
        runCatching {
            if (genreIds.isEmpty()) return@runCatching emptyList()
            val res = get(
                if (isSeries) "/discover/tv" else "/discover/movie",
                listOf(
                    "with_genres" to genreIds.take(5).joinToString("|"),
                    "sort_by" to "popularity.desc",
                ),
                TmdbSearchResponse.serializer(),
            )
            res.results.filter { it.id != id && it.poster_path != null }.take(20)
        }.getOrDefault(emptyList())
    }

    /** Preferred streaming providers (US first, then any region), like the web row. */
    suspend fun watchProviders(isSeries: Boolean, id: Int): List<WatchProviderKey> =
        withContext(Dispatchers.IO) {
            runCatching {
                val results = get(
                    if (isSeries) "/tv/$id/watch/providers" else "/movie/$id/watch/providers",
                    emptyList(),
                    TmdbWatchProvidersResponse.serializer(),
                ).results
                pickProviders(results["US"]).ifEmpty {
                    results.values.firstNotNullOfOrNull { region ->
                        pickProviders(region).ifEmpty { null }
                    } ?: emptyList()
                }
            }.getOrDefault(emptyList())
        }

    /** Episodes for one season (used by the episodes carousel). */
    suspend fun season(id: Int, seasonNumber: Int): List<TmdbEpisode> = withContext(Dispatchers.IO) {
        runCatching {
            get(
                "/tv/$id/season/$seasonNumber",
                emptyList(),
                TmdbSeasonResponse.serializer(),
            ).episodes
        }.getOrDefault(emptyList())
    }
}

// --- models -----------------------------------------------------------------

@Serializable
data class TmdbSearchResponse(val results: List<TmdbSearchHit> = emptyList())

@Serializable
data class TmdbSearchHit(
    val id: Int = 0,
    val title: String = "", // movie
    val name: String = "", // tv
    val release_date: String = "",
    val first_air_date: String = "",
    val poster_path: String? = null,
    val vote_average: Double = 0.0,
) {
    val displayTitle: String get() = title.ifBlank { name }
}

@Serializable
data class TmdbGenre(val id: Int = 0, val name: String = "")

@Serializable
data class TmdbNamed(val id: Int = 0, val name: String = "")

@Serializable
data class TmdbSeasonSummary(
    val season_number: Int = 0,
    val episode_count: Int = 0,
    val name: String = "",
)

@Serializable
data class TmdbDetail(
    val id: Int = 0,
    val title: String = "",
    val name: String = "",
    val overview: String = "",
    val tagline: String = "",
    val backdrop_path: String? = null,
    val poster_path: String? = null,
    val runtime: Int? = null,
    val episode_run_time: List<Int> = emptyList(),
    val vote_average: Double = 0.0,
    val release_date: String = "",
    val first_air_date: String = "",
    val last_air_date: String? = null,
    val status: String = "",
    val number_of_seasons: Int = 0,
    val genres: List<TmdbGenre> = emptyList(),
    val seasons: List<TmdbSeasonSummary> = emptyList(),
    val created_by: List<TmdbNamed> = emptyList(),
    val networks: List<TmdbNamed> = emptyList(),
)

@Serializable
data class TmdbCreditsResponse(val cast: List<TmdbCastMember> = emptyList())

@Serializable
data class TmdbCastMember(
    val id: Int = 0,
    val name: String = "",
    val character: String = "",
    val profile_path: String? = null,
    val order: Int = 0,
)

@Serializable
data class TmdbImagesResponse(
    val logos: List<TmdbImage> = emptyList(),
    val backdrops: List<TmdbImage> = emptyList(),
)

@Serializable
data class TmdbImage(val file_path: String = "", val iso_639_1: String? = null)

@Serializable
data class TmdbVideosResponse(val results: List<TmdbVideo> = emptyList())

@Serializable
data class TmdbVideo(
    val key: String = "",
    val site: String = "",
    val type: String = "",
    val official: Boolean = false,
)

@Serializable
data class TmdbSeasonResponse(
    val season_number: Int = 0,
    val episodes: List<TmdbEpisode> = emptyList(),
)

@Serializable
data class TmdbWatchProvidersResponse(
    val results: Map<String, TmdbProviderRegion> = emptyMap(),
)

@Serializable
data class TmdbProviderRegion(
    val flatrate: List<TmdbProvider>? = null,
    val free: List<TmdbProvider>? = null,
    val ads: List<TmdbProvider>? = null,
    val rent: List<TmdbProvider>? = null,
    val buy: List<TmdbProvider>? = null,
)

@Serializable
data class TmdbProvider(
    val provider_id: Int = 0,
    val provider_name: String = "",
)

@Serializable
data class TmdbEpisode(
    val id: Int = 0,
    val episode_number: Int = 0,
    val season_number: Int = 0,
    val name: String = "",
    val overview: String = "",
    val still_path: String? = null,
    val air_date: String? = null,
    val runtime: Int? = null,
    val vote_average: Double = 0.0,
)
