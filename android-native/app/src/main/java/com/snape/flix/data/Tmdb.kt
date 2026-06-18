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

    /**
     * Resolve a MovieBox title+year to its TMDB id.
     *
     * The previous version hard-filtered the TMDB query by year (so a MovieBox
     * year that was off by one silently dropped the correct title) and, on a
     * miss, accepted `hits.first()` with no title check at all (so unrelated
     * titles got matched). This scores every candidate by normalized-title
     * similarity + year proximity (mirroring the web `pickBestMovieboxMatch`
     * bars), and only accepts a hit that actually looks like the title — so we
     * capture valid matches accurately without enriching from the wrong entry.
     */
    suspend fun resolveId(isSeries: Boolean, title: String, year: String): Int? =
        withContext(Dispatchers.IO) {
            runCatching {
                val q = cleanTitle(title)
                if (q.isBlank()) return@runCatching null
                val path = if (isSeries) "/search/tv" else "/search/movie"
                // No hard year filter — fetch candidates and rank them ourselves
                // so a slightly-off MovieBox year can't drop the right title.
                val hits = get(
                    path,
                    listOf("query" to q, "include_adult" to "false"),
                    TmdbSearchResponse.serializer(),
                ).results
                if (hits.isEmpty()) return@runCatching null

                val wantYear = year.take(4).toIntOrNull()
                val target = normalizeTitle(q)

                data class Scored(val id: Int, val titleSim: Double, val score: Double)

                val scored = hits.map { hit ->
                    val hitYear = (if (isSeries) hit.first_air_date else hit.release_date)
                        .take(4).toIntOrNull()
                    val titleSim = titleSimilarity(target, normalizeTitle(hit.displayTitle))
                    val yearScore = when {
                        wantYear == null || hitYear == null -> 0.4 // unknown → neutral-ish
                        hitYear == wantYear -> 1.0
                        kotlin.math.abs(hitYear - wantYear) == 1 -> 0.6
                        else -> 0.0
                    }
                    Scored(hit.id, titleSim, titleSim * 0.8 + yearScore * 0.2)
                }.sortedByDescending { it.score }

                val best = scored.first()
                when {
                    // Exact (normalized) title: accept even if the year is weak.
                    best.titleSim >= 0.98 -> best.id
                    // Otherwise require a confident combined + title score, like
                    // the web matcher's minScore 0.62 / minTitle 0.55 bars.
                    best.score >= 0.62 && best.titleSim >= 0.55 -> best.id
                    else -> null
                }
            }.getOrNull()
        }

    /** Normalize a title for comparison: lowercase, de-punctuate, drop a leading article. */
    private fun normalizeTitle(s: String): String =
        s.lowercase()
            .replace("&", " and ")
            .replace(Regex("[^a-z0-9]+"), " ")
            .trim()
            .replace(Regex("^(the|a|an) "), "")
            .replace(Regex("\\s+"), " ")

    /** Title similarity in [0,1]: max of a Levenshtein ratio and token-set Jaccard. */
    private fun titleSimilarity(a: String, b: String): Double {
        if (a.isEmpty() || b.isEmpty()) return 0.0
        if (a == b) return 1.0
        val lev = run {
            val dist = levenshtein(a, b)
            1.0 - dist.toDouble() / maxOf(a.length, b.length)
        }
        val jaccard = run {
            val sa = a.split(" ").toSet()
            val sb = b.split(" ").toSet()
            val inter = sa.intersect(sb).size.toDouble()
            val union = sa.union(sb).size.toDouble()
            if (union == 0.0) 0.0 else inter / union
        }
        return maxOf(lev, jaccard)
    }

    private fun levenshtein(a: String, b: String): Int {
        val prev = IntArray(b.length + 1) { it }
        val cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = minOf(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            }
            System.arraycopy(cur, 0, prev, 0, cur.size)
        }
        return prev[b.length]
    }

    /**
     * Multi search (movies + series) for the search screen. Filters out people and
     * poster-less hits, and — per the released-only rule — drops anything with a
     * blank or future release/air date.
     */
    suspend fun searchMulti(query: String, page: Int = 1): List<TmdbSearchHit> = withContext(Dispatchers.IO) {
        runCatching {
            val today = todayIso()
            get(
                "/search/multi",
                listOf("query" to query, "include_adult" to "false", "page" to page.toString()),
                TmdbSearchResponse.serializer(),
            ).results
                .filter { (it.media_type == "movie" || it.media_type == "tv") && it.poster_path != null }
                .filter { it.date.isNotBlank() && it.date <= today }
        }.getOrDefault(emptyList())
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
            val today = todayIso()
            val res = get(
                if (isSeries) "/discover/tv" else "/discover/movie",
                listOf(
                    "with_genres" to genreIds.take(5).joinToString("|"),
                    "sort_by" to "popularity.desc",
                    // Released-only: no future/unaired recommendations.
                    (if (isSeries) "first_air_date.lte" else "primary_release_date.lte") to today,
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

    /** ISO date (yyyy-MM-dd, UTC) for today — for the discover "released-by-now" filter. */
    private fun todayIso(): String {
        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
        return fmt.format(java.util.Date())
    }

    /**
     * Discover a curated section from TMDB, mirroring `lib/tmdb.ts`'s per-provider
     * queries. Used for the web home sections MovieBox's feed doesn't cover
     * (Punjabi, Turkish, Animation, Anime) — and as a fallback for any section
     * whose MovieBox row is absent.
     */
    suspend fun discoverSection(key: String): List<TmdbSearchHit> = withContext(Dispatchers.IO) {
        runCatching {
            val today = todayIso()
            val (isSeries, params) = when (key) {
                "hollywood" -> false to listOf(
                    "with_original_language" to "en", "with_origin_country" to "US",
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                "bollywood" -> false to listOf(
                    "with_original_language" to "hi",
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                "punjabi" -> false to listOf(
                    "with_original_language" to "pa",
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                "tamil" -> false to listOf(
                    "with_original_language" to "ta",
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                "korean" -> true to listOf(
                    "with_original_language" to "ko",
                    "sort_by" to "popularity.desc", "first_air_date.lte" to today,
                    "include_null_first_air_dates" to "false",
                )
                "turkish" -> true to listOf(
                    "with_original_language" to "tr",
                    "sort_by" to "popularity.desc", "first_air_date.lte" to today,
                    "include_null_first_air_dates" to "false",
                )
                "animation" -> false to listOf(
                    "with_genres" to "16",
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                "anime" -> false to listOf(
                    "with_genres" to "16", "with_original_language" to "ja",
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                // Fallbacks for the MovieBox-sourced rows, used only if the live
                // home feed is unavailable.
                "trending" -> false to listOf(
                    "sort_by" to "popularity.desc", "primary_release_date.lte" to today,
                )
                "topseries" -> true to listOf(
                    "sort_by" to "popularity.desc", "first_air_date.lte" to today,
                    "include_null_first_air_dates" to "false",
                )
                else -> false to emptyList()
            }
            if (params.isEmpty()) return@runCatching emptyList()
            get(
                if (isSeries) "/discover/tv" else "/discover/movie",
                params,
                TmdbSearchResponse.serializer(),
            ).results.filter { it.poster_path != null }
        }.getOrDefault(emptyList())
    }

    /**
     * Discover movies available on a given watch provider (TMDB provider id).
     * Mirrors the web `getMoviesByProviderPage` in `lib/tmdb.ts`.
     */
    suspend fun discoverMoviesByProvider(providerId: Int, region: String = "US", page: Int = 1): List<TmdbSearchHit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val today = todayIso()
                get(
                    "/discover/movie",
                    listOf(
                        "with_watch_providers" to providerId.toString(),
                        "watch_region" to region,
                        "sort_by" to "popularity.desc",
                        "primary_release_date.lte" to today,
                        "page" to page.toString(),
                    ),
                    TmdbSearchResponse.serializer(),
                ).results.filter { it.poster_path != null }
            }.getOrDefault(emptyList())
        }

    /**
     * Discover TV series available on a given watch provider (TMDB provider id).
     * Mirrors the web `getSeriesByProviderPage` in `lib/tmdb.ts`.
     */
    suspend fun discoverSeriesByProvider(providerId: Int, region: String = "US", page: Int = 1): List<TmdbSearchHit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val today = todayIso()
                get(
                    "/discover/tv",
                    listOf(
                        "with_watch_providers" to providerId.toString(),
                        "watch_region" to region,
                        "sort_by" to "popularity.desc",
                        "first_air_date.lte" to today,
                        "include_null_first_air_dates" to "false",
                        "page" to page.toString(),
                    ),
                    TmdbSearchResponse.serializer(),
                ).results.filter { it.poster_path != null }
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

    // --- person / actor page -------------------------------------------------

    /** Person bio/details for the actor page (web `getPerson`). */
    suspend fun person(id: Int): TmdbPerson? = withContext(Dispatchers.IO) {
        runCatching {
            get("/person/$id", emptyList(), TmdbPerson.serializer())
        }.getOrNull()
    }

    /** The person's movie credits (cast), web `getPersonMovieCredits`. */
    suspend fun personMovieCredits(id: Int): List<TmdbPersonCredit> = withContext(Dispatchers.IO) {
        runCatching {
            get("/person/$id/movie_credits", emptyList(), TmdbPersonCreditsResponse.serializer()).cast
        }.getOrDefault(emptyList())
    }

    /** The person's TV credits (cast), web `getPersonSeriesCredits`. */
    suspend fun personSeriesCredits(id: Int): List<TmdbPersonCredit> = withContext(Dispatchers.IO) {
        runCatching {
            get("/person/$id/tv_credits", emptyList(), TmdbPersonCreditsResponse.serializer()).cast
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
    val media_type: String = "", // "movie" | "tv" (only set by /search/multi)
) {
    val displayTitle: String get() = title.ifBlank { name }

    /** TV when /search/multi says so, or (for discover/recs hits) when only `name`
     *  is populated. */
    val isSeries: Boolean get() = media_type == "tv" || (title.isBlank() && name.isNotBlank())

    /** Release/air date, whichever this hit carries. */
    val date: String get() = if (isSeries) first_air_date else release_date

    /** Build the TMDB ref used to open the detail page (and resolve MovieBox). */
    fun toRef(seriesOverride: Boolean? = null): TmdbRef {
        val series = seriesOverride ?: isSeries
        val d = if (series) first_air_date else release_date
        return TmdbRef(
            id = id,
            isSeries = series,
            title = displayTitle,
            year = d.take(4),
            voteAverage = vote_average.takeIf { it > 0 },
            posterUrl = TmdbRepository.img(poster_path, "w342"),
        )
    }
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

@Serializable
data class TmdbPerson(
    val id: Int = 0,
    val name: String = "",
    val biography: String = "",
    val birthday: String? = null,
    val deathday: String? = null,
    val place_of_birth: String? = null,
    val profile_path: String? = null,
    val known_for_department: String = "",
    val popularity: Double = 0.0,
)

@Serializable
data class TmdbPersonCreditsResponse(val cast: List<TmdbPersonCredit> = emptyList())

/**
 * One acting credit from `/person/{id}/movie_credits` or `/tv_credits`. Movies
 * carry [title] + [release_date]; series carry [name] + [first_air_date], so the
 * derived helpers below unify them for the actor page (which mixes both).
 */
@Serializable
data class TmdbPersonCredit(
    val id: Int = 0,
    val title: String = "", // movie
    val name: String = "", // tv
    val character: String = "",
    val poster_path: String? = null,
    val backdrop_path: String? = null,
    val release_date: String = "", // movie
    val first_air_date: String = "", // tv
    val vote_average: Double = 0.0,
    val popularity: Double = 0.0,
) {
    val displayTitle: String get() = title.ifBlank { name }

    /** Release/air date, whichever this credit type carries. */
    val date: String get() = release_date.ifBlank { first_air_date }

    /** TV credits carry `name`/`first_air_date`; movie credits carry `title`/`release_date`. */
    val isSeries: Boolean get() = title.isBlank() && name.isNotBlank()

    /** Same "has both images" rule the homepage/web `filterHasImages` uses. */
    val hasImages: Boolean get() = !backdrop_path.isNullOrBlank() && !poster_path.isNullOrBlank()

    /** The TMDB ref this credit opens on the detail page. */
    fun toRef(): TmdbRef = TmdbRef(
        id = id,
        isSeries = isSeries,
        title = displayTitle,
        year = date.take(4),
        voteAverage = vote_average.takeIf { it > 0 },
        posterUrl = TmdbRepository.img(poster_path, "w342"),
    )
}
