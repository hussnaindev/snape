package com.snape.flix.data

import kotlinx.serialization.Serializable

/**
 * Data models for the MovieBox mobile BFF (api.inmoviebox.com/wefeed-mobile-bff).
 * Every response is `{ code, message, data }`; `code == 0` means success.
 * All `*Id` values are 64-bit and are kept as [String] to avoid precision loss.
 */

// --- search -----------------------------------------------------------------

@Serializable
data class SearchRequest(
    val keyword: String,
    val page: Int = 1,
    val perPage: Int = 24,
    // 0 = all (movies, series, music, …). We filter to 1/2 client-side.
    val subjectType: Int = 0,
)

@Serializable
data class SearchResponse(val code: Int = -1, val message: String = "", val data: SearchData? = null)

@Serializable
data class SearchData(
    val items: List<SubjectItem> = emptyList(),
    val pager: Pager? = null,
)

/**
 * One page of grouped search results plus whether more pages remain — drives the
 * search grid's infinite scroll.
 */
data class SearchPage(
    val groups: List<SubjectGroup>,
    val hasMore: Boolean,
)

@Serializable
data class Cover(val url: String = "")

@Serializable
data class SubjectItem(
    val subjectId: String = "",
    val subjectType: Int = 0, // 1 = movie, 2 = tv series
    val title: String = "",
    val description: String = "",
    val releaseDate: String = "",
    val duration: String = "", // human string e.g. "2h 28m"
    val genre: String = "",
    val cover: Cover? = null,
    val imdbRatingValue: String = "",
    val corner: String = "", // language/quality badge e.g. "Hindi", "Tamil"
    val seNum: Int = 0, // number of seasons (tv)
    val hasResource: Boolean = false,
    // Present on home-feed (`tab-operating`) subjects, empty on search hits.
    val detailUrl: String = "",
    val countryName: String = "",
    // The TMDB id this subject was matched from, stamped when a TMDB ref resolves
    // to this MovieBox subject. Persisted so watchlist/history cards can reopen by
    // ref. Null for un-stamped/legacy entries (default keeps old JSON readable).
    val tmdbId: Int? = null,
) {
    val isSeries: Boolean get() = subjectType == 2
    val year: String get() = releaseDate.take(4)
    val posterUrl: String? get() = cover?.url?.ifBlank { null }
    val rating: Double? get() = imdbRatingValue.toDoubleOrNull()

    /** Title without the trailing "[Hindi]"/"[Tamil]" audio tag. */
    val cleanTitle: String get() = title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim()

    /** Audio-variant badge for menus, e.g. "Hindi"/"Tamil"/"Original". */
    val variantLabel: String get() = corner.ifBlank { "Original" }

    /** A variant is the "original" when it carries no language badge. */
    val isOriginal: Boolean get() = corner.isBlank() || corner.equals("Original", true)

    /** Title without the trailing "[Hindi]"/"[Tamil]" tag, lower-cased — used
     *  to fold audio variants of the same title into one search result. */
    private val baseTitle: String
        get() = title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim().lowercase()

    /** Same movie/series across audio variants share this key. */
    val groupKey: String get() = "$subjectType|$year|$baseTitle"
}

/**
 * One search result that folds together every audio variant of the same title.
 * [primary] is the original (or first) variant shown on the card and played by
 * default; [variants] lists all of them (primary first) for the player's audio
 * menu. Variants other than [primary] are only fetched when the user switches.
 */
data class SubjectGroup(
    val primary: SubjectItem,
    val variants: List<SubjectItem>,
) {
    val hasVariants: Boolean get() = variants.size > 1
}

/**
 * A TMDB title to resolve against MovieBox. TMDB is the catalogue/source of truth
 * across the app; this ref is what travels from a card/search-hit/recommendation
 * into the detail page, where it is (a) enriched with TMDB metadata and (b)
 * resolved to a playable MovieBox [SubjectGroup] in parallel.
 */
@Serializable
data class TmdbRef(
    val id: Int,
    val isSeries: Boolean,
    val title: String,
    val year: String,
    val runtime: Int? = null,
    val voteAverage: Double? = null,
    val posterUrl: String? = null,
) {
    val yearInt: Int? get() = year.take(4).toIntOrNull()
}

// --- home feed (tab-operating) ----------------------------------------------

@Serializable
data class TabOperatingResponse(val code: Int = -1, val data: TabOperatingData? = null)

@Serializable
data class TabOperatingData(val items: List<HomeRow> = emptyList())

/**
 * One row of the MovieBox app home feed. `type` is BANNER / FILTER /
 * SUBJECTS_MOVIE / CUSTOM / SPORT_LIVE / … — only SUBJECTS_MOVIE rows carry a
 * populated [subjects] list (the others are deeplink-driven on the app).
 */
@Serializable
data class HomeRow(
    val type: String = "",
    val title: String = "",
    val opId: String = "",
    val subjects: List<SubjectItem> = emptyList(),
)

// --- home UI models (built by HomeRepository, consumed by the home screen) ---

/**
 * A single home-screen poster card. When [subject] is non-null the card came
 * from MovieBox and opens detail directly; otherwise it came from TMDB and must
 * be resolved to a MovieBox subject (via search) before it can play.
 */
data class HomeCard(
    val title: String,
    val posterUrl: String?,
    val rating: Double?,
    val isSeries: Boolean,
    val year: String,
    val subject: SubjectItem?,
    val tmdbId: Int? = null,
) {
    /** The TMDB ref this card opens (null when the card carries no TMDB id). */
    fun toRef(): TmdbRef? = tmdbId?.let {
        TmdbRef(
            id = it,
            isSeries = isSeries,
            title = title,
            year = year,
            voteAverage = rating,
            posterUrl = posterUrl,
        )
    }
}

/**
 * One curated provider section, mirroring the web `CuratedProviderSection`.
 * Cards are available immediately; the TMDB-enriched hero fields ([heroBackdropUrl],
 * [heroLogoUrl], …) are patched in asynchronously, so they are nullable.
 */
data class HomeSection(
    val key: String,
    val label: String,
    val brandColor: Long, // 0xFFRRGGBB
    val isSeries: Boolean,
    val cards: List<HomeCard>,
    val heroTitle: String,
    val heroYear: String? = null,
    val heroRating: String? = null,
    val rtScore: Int? = null,
    val overview: String? = null,
    val heroBackdropUrl: String? = null,
    val heroLogoUrl: String? = null,
    val logoAsset: String? = null,
    val backdropOffsetX: Float = 0f,
)

// --- season-info ------------------------------------------------------------

@Serializable
data class SeasonInfoResponse(val code: Int = -1, val data: SeasonInfoData? = null)

@Serializable
data class SeasonInfoData(val seasons: List<SeasonItem> = emptyList())

@Serializable
data class SeasonItem(val se: Int = 0, val maxEp: Int = 0)

// --- play-info --------------------------------------------------------------

@Serializable
data class PlayInfoResponse(val code: Int = -1, val message: String = "", val data: PlayInfoData? = null)

@Serializable
data class PlayInfoData(val streams: List<Stream> = emptyList(), val title: String = "")

@Serializable
data class Stream(
    val format: String = "", // "DASH"
    val id: String = "",
    val url: String = "",
    val resolutions: String = "", // "1080,720,480"
    val signCookie: String = "", // CloudFront cookies for the CDN
    val codecName: String = "",
)

// --- resource (used only to resolve a resourceId for captions) --------------

@Serializable
data class ResourceResponse(val code: Int = -1, val data: ResourceData? = null)

@Serializable
data class ResourceData(val list: List<ResourceItem> = emptyList(), val pager: Pager? = null)

@Serializable
data class Pager(val hasMore: Boolean = false, val nextPage: String = "", val page: String = "")

@Serializable
data class ResourceItem(
    val resourceId: String = "",
    val se: Int = 0,
    val ep: Int = 0,
    val resolution: Int = 0,
)

// --- captions ---------------------------------------------------------------

@Serializable
data class CaptionsResponse(val code: Int = -1, val data: CaptionsData? = null)

@Serializable
data class CaptionsData(val extCaptions: List<Caption> = emptyList())

@Serializable
data class Caption(
    val id: String = "",
    val lan: String = "", // bcp-47-ish code e.g. "en"
    val lanName: String = "", // display name e.g. "English"
    val url: String = "", // signed .srt url
)
