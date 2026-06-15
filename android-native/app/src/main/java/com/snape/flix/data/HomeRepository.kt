package com.snape.flix.data

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Builds the native home screen's curated sections — a pixel-faithful match to
 * the web home (`app/page.tsx` → `CuratedProviderSection`). Catalogue data comes
 * from the MovieBox app home feed (`tab-operating`) where a row matches one of
 * the web's sections; sections MovieBox doesn't cover (Punjabi, Turkish,
 * Animation, Anime) come from TMDB discover. Each section's hero banner
 * (backdrop, title logo, overview, rating) is enriched from TMDB — the same
 * metadata the web section shows but the MovieBox poster lacks.
 *
 * Sections are returned with their cards first (fast first paint); [enrichHero]
 * then patches the TMDB-derived hero fields per section so they fade in.
 */
object HomeRepository {

    /** One curated section, in the web's order. `movieboxRowTitle` is the home
     *  feed row whose subjects feed this section (null → TMDB-sourced). */
    data class SectionSpec(
        val key: String,
        val label: String,
        val brandColor: Long,
        val isSeries: Boolean,
        val movieboxRowTitle: String?,
    )

    val SPECS: List<SectionSpec> = listOf(
        SectionSpec("topseries", "Top Series", 0xFFEC4899, true, "Top Series"),
        SectionSpec("trending", "Trending", 0xFFF59E0B, false, "Trending"),
        SectionSpec("hollywood", "Hollywood", 0xFFDC2626, false, "Hollywood"),
        SectionSpec("bollywood", "Bollywood", 0xFFF97316, false, "Bollywood"),
        SectionSpec("animation", "Animation", 0xFF3B82F6, false, null),
        SectionSpec("anime", "Anime", 0xFFA855F7, false, null),
        SectionSpec("punjabi", "Punjabi", 0xFFEAB308, false, null),
        SectionSpec("tamil", "South", 0xFF0D9488, false, "South Indian"),
    )

    private const val CAROUSEL_SIZE = 10

    /** Build all sections (cards only). MovieBox feed is fetched once and shared;
     *  the per-section builds (incl. TMDB discover for fallback rows) run in
     *  parallel so first paint isn't gated on serial network calls. */
    suspend fun buildSections(): List<HomeSection> = coroutineScope {
        val rows = runCatching { MovieBoxRepository.homeFeed() }.getOrDefault(emptyList())
        val built = SPECS.map { spec -> async { buildSection(spec, rows) } }.awaitAll()
        dedupeHeroes(built)
    }

    /** A stable identity for a card, used to keep each section's lead (hero) card
     *  distinct across sections. */
    private fun cardKey(c: HomeCard): String =
        c.subject?.subjectId?.takeIf { it.isNotBlank() }
            ?: c.tmdbId?.toString()
            ?: c.title.trim().lowercase()

    /**
     * Ensure no two sections lead with the same title. A section's first card
     * drives its hero banner, so if that card already leads an earlier section,
     * rotate it (and any other already-used leads) to the back of the row so the
     * next distinct title becomes the lead — keeping every banner unique.
     */
    private fun dedupeHeroes(sections: List<HomeSection>): List<HomeSection> {
        val used = HashSet<String>()
        return sections.map { section ->
            val cards = section.cards
            if (cards.isEmpty()) return@map section
            val pick = cards.indexOfFirst { cardKey(it) !in used }.let { if (it >= 0) it else 0 }
            used.add(cardKey(cards[pick]))
            if (pick == 0) {
                section
            } else {
                // chosen lead first, then the duplicates that preceded it (to the back)
                val reordered = cards.drop(pick) + cards.take(pick)
                section.copy(cards = reordered, heroTitle = reordered.first().title)
            }
        }
    }

    private suspend fun buildSection(spec: SectionSpec, rows: List<HomeRow>): HomeSection {
        val mbRow = spec.movieboxRowTitle?.let { wanted ->
            rows.firstOrNull {
                it.type == "SUBJECTS_MOVIE" &&
                    it.title.contains(wanted, ignoreCase = true) &&
                    it.subjects.isNotEmpty()
            }
        }

        val cards: List<HomeCard> = if (mbRow != null) {
            mbRow.subjects
                .filter { it.hasResource && it.posterUrl != null }
                .map { s ->
                    HomeCard(
                        title = s.cleanTitle,
                        posterUrl = s.posterUrl,
                        rating = s.rating?.takeIf { it > 0 },
                        isSeries = s.isSeries,
                        year = s.year,
                        subject = s,
                    )
                }
                .take(CAROUSEL_SIZE)
        } else {
            TmdbRepository.discoverSection(spec.key)
                .take(CAROUSEL_SIZE)
                .map { hit ->
                    val date = if (spec.isSeries) hit.first_air_date else hit.release_date
                    HomeCard(
                        title = hit.displayTitle,
                        posterUrl = TmdbRepository.img(hit.poster_path, "w342"),
                        rating = hit.vote_average.takeIf { it > 0 },
                        isSeries = spec.isSeries,
                        year = date.take(4),
                        subject = null,
                        tmdbId = hit.id,
                    )
                }
        }

        return HomeSection(
            key = spec.key,
            label = spec.label,
            brandColor = spec.brandColor,
            isSeries = spec.isSeries,
            cards = cards,
            heroTitle = cards.firstOrNull()?.title ?: spec.label,
        )
    }

    /**
     * Resolve the section hero's TMDB entry and patch in its backdrop, title
     * logo, overview, year, rating and Rotten-Tomatoes-style score — exactly the
     * fields the web `CuratedProviderSection` hero renders.
     */
    suspend fun enrichHero(section: HomeSection): HomeSection {
        val first = section.cards.firstOrNull() ?: return section
        // Use the hero card's own type — these rows (Trending, Top Series) mix
        // movies and series, so the section's nominal type isn't always right.
        val isSeries = first.isSeries
        val id = first.tmdbId
            ?: TmdbRepository.resolveId(isSeries, first.title, first.year)
            ?: return section

        val detail = TmdbRepository.detail(isSeries, id) ?: return section
        val logo = TmdbRepository.logoUrl(isSeries, id)

        val vote = detail.vote_average
        val date = if (isSeries) detail.first_air_date else detail.release_date
        return section.copy(
            heroTitle = detail.title.ifBlank { detail.name }.ifBlank { section.heroTitle },
            heroYear = date.take(4).takeIf { it.isNotBlank() && it != "0000" },
            heroRating = if (vote > 0) "%.1f".format(vote) else null,
            rtScore = if (vote > 0) (vote * 10).toInt() else null,
            overview = detail.overview.ifBlank { null },
            heroBackdropUrl = TmdbRepository.img(detail.backdrop_path, "w780"),
            heroLogoUrl = logo,
        )
    }
}
