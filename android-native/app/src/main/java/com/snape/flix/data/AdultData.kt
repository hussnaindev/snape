package com.snape.flix.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Bundled data from the MovieBox adult-studio discovery scan
 * (scripts/moviebox-results.json → assets/adult.json).
 */
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
) {
    /** First word of the title, upper-cased — used as the studio badge. */
    val studioName: String get() = title.trim().split(Regex("\\s+")).firstOrNull()?.uppercase() ?: ""
}

/** Loads the bundled adult.json and maps entries to [SubjectGroup] for the grid. */
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
                hasResource = true,
            )
            SubjectGroup(primary = subject, variants = listOf(subject))
        }
    }
}
