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
) {
    val studioName: String get() = title.trim().split(Regex("\\s+")).firstOrNull()?.uppercase() ?: ""
}

object AdultRepository {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }

    fun loadGroups(context: Context): List<SubjectGroup> {
        val text = context.assets.open("adult.json").bufferedReader().use { it.readText() }
        val manifest = json.decodeFromString(AdultManifest.serializer(), text)
        return manifest.matches.map { item ->
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
            )
            SubjectGroup(primary = subject, variants = listOf(subject))
        }
    }
}
