package com.snape.flix.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class AdultManifest(
    val generatedAt: String = "",
    val totalMatches: Int = 0,
    val matches: List<AdultItem> = emptyList(),
)

@Serializable
data class AdultCastMember(
    val name: String = "",
    val character: String = "Herself",
)

@Serializable
data class AdultItem(
    val subjectId: String = "",
    val title: String = "",
    val postTitle: String? = null,
    val releaseDate: String? = null,
    val subjectType: Int? = null,
    val duration: String? = null,
    val discoveredBy: String? = null,
    val coverUrl: String? = null,
    val description: String? = null,
    val genre: String? = null,
    val imdbRatingValue: String? = null,
    val studio: String? = null,
    val backdropUrl: String? = null,
    val cast: List<AdultCastMember>? = null,
    val recommendations: List<String>? = null,
) {
    val studioName: String get() = studio ?: title.trim().split(Regex("\\s+")).firstOrNull()?.uppercase() ?: ""
}

object AdultRepository {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }

    fun loadGroups(context: Context): List<SubjectGroup> {
        val text = context.assets.open("adult.json").bufferedReader().use { it.readText() }
        val manifest = json.decodeFromString(AdultManifest.serializer(), text)

        val idToItem = manifest.matches.associateBy { it.subjectId }

        return manifest.matches.map { item ->
            val adultCast = item.cast?.map { c ->
                TmdbCastMember(
                    id = c.name.hashCode(),
                    name = c.name,
                    character = c.character,
                )
            } ?: emptyList()

            val adultRecs = item.recommendations?.mapNotNull { recId ->
                val rec = idToItem[recId] ?: return@mapNotNull null
                TmdbSearchHit(
                    id = recId.hashCode(),
                    title = rec.title,
                    poster_path = null,
                    vote_average = rec.imdbRatingValue?.toDoubleOrNull() ?: 0.0,
                )
            } ?: emptyList()

            val subject = SubjectItem(
                subjectId = item.subjectId,
                subjectType = item.subjectType ?: 1,
                title = item.title,
                releaseDate = item.releaseDate ?: "",
                description = item.description ?: "",
                genre = item.genre ?: "",
                duration = item.duration ?: "",
                imdbRatingValue = item.imdbRatingValue ?: "",
                cover = item.coverUrl?.let { Cover(it) },
                hasResource = true,
                adultCast = adultCast,
                adultRecs = adultRecs,
                adultBackdropUrl = item.backdropUrl ?: item.coverUrl,
            )
            SubjectGroup(primary = subject, variants = listOf(subject))
        }
    }
}
