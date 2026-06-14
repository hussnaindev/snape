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
    val perPage: Int = 20,
    // 0 = all (movies, series, music, …). We filter to 1/2 client-side.
    val subjectType: Int = 0,
)

@Serializable
data class SearchResponse(val code: Int = -1, val message: String = "", val data: SearchData? = null)

@Serializable
data class SearchData(val items: List<SubjectItem> = emptyList())

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
) {
    val isSeries: Boolean get() = subjectType == 2
    val year: String get() = releaseDate.take(4)
    val posterUrl: String? get() = cover?.url?.ifBlank { null }
    val rating: Double? get() = imdbRatingValue.toDoubleOrNull()
}

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
