package com.snape.flix.ui.streaming

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.HomeCard
import com.snape.flix.data.HomeSection
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.WatchProviderKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class StreamingSitesState(
    val sections: List<HomeSection> = emptyList(),
    val loading: Boolean = true,
)

class StreamingSitesViewModel : ViewModel() {

    private val _state = MutableStateFlow(StreamingSitesState())
    val state: StateFlow<StreamingSitesState> = _state.asStateFlow()

    // Hero metadata matching web provider-section.tsx
    private data class HeroMeta(
        val title: String,
        val year: String,
        val runtime: String,
        val rating: String,
        val overview: String,
        val rtScore: Int,
        val backdropAsset: String?,
    )

    private val HERO_META = mapOf(
        WatchProviderKey.NETFLIX to HeroMeta(
            "Stranger Things", "2016", "5 Seasons", "8.7",
            "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
            90, "file:///android_asset/backdrop-netflix.avif",
        ),
        WatchProviderKey.MAX to HeroMeta(
            "House of the Dragon", "2022", "2 Seasons", "8.4",
            "The Targaryen dynasty is at the absolute apex of its power, with more than 15 dragons under their yoke.",
            87, "file:///android_asset/backdrop-max.avif",
        ),
        WatchProviderKey.PRIMEVIDEO to HeroMeta(
            "The Boys", "2019", "5 Seasons", "8.6",
            "A group of vigilantes known informally as \"The Boys\" set out to take down corrupt superheroes.",
            93, "file:///android_asset/backdrop-primevideo.avif",
        ),
        WatchProviderKey.DISNEYPLUS to HeroMeta(
            "Loki", "2021", "2 Seasons", "8.5",
            "After stealing the Tesseract during the events of \"Avengers: Endgame,\" an alternate version of Loki is brought to the mysterious Time Variance Authority.",
            87, "file:///android_asset/backdrop-disneyplus.avif",
        ),
        WatchProviderKey.PARAMOUNTPLUS to HeroMeta(
            "Yellowstone", "2018", "5 Seasons", "8.6",
            "Follow the violent world of the Dutton family, who controls the largest contiguous ranch in the United States.",
            83, "file:///android_asset/backdrop-paramountplus.avif",
        ),
        WatchProviderKey.APPLETV to HeroMeta(
            "Dune", "2021", "2h 35m", "8.6",
            "Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe.",
            83, null,
        ),
    )

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)

            val sections = WatchProviderKey.entries.map { provider ->
                val meta = HERO_META[provider] ?: return@map null

                val (movies, series, logoUrl) = try {
                    val mv = TmdbRepository.discoverMoviesByProvider(provider.tmdbId)
                    val sv = TmdbRepository.discoverSeriesByProvider(provider.tmdbId)
                    val logo = TmdbRepository.logoUrl(provider.heroIsSeries, provider.heroId)
                    Triple(mv, sv, logo)
                } catch (_: Exception) {
                    Triple(emptyList(), emptyList(), null)
                }

                // Fetch TMDB backdrop for providers that don't have a bundled asset
                val backdrop = meta.backdropAsset ?: runCatching {
                    TmdbRepository.img(TmdbRepository.detail(provider.heroIsSeries, provider.heroId)?.backdrop_path, "w1280")
                }.getOrNull()

                val cards = buildList {
                    movies.forEach { m ->
                        add(
                            HomeCard(
                                title = m.displayTitle,
                                posterUrl = TmdbRepository.img(m.poster_path, "w342"),
                                rating = m.vote_average.takeIf { it > 0 },
                                isSeries = false,
                                year = m.release_date.take(4),
                                subject = null,
                                tmdbId = m.id,
                            )
                        )
                    }
                    series.forEach { s ->
                        add(
                            HomeCard(
                                title = s.displayTitle,
                                posterUrl = TmdbRepository.img(s.poster_path, "w342"),
                                rating = s.vote_average.takeIf { it > 0 },
                                isSeries = true,
                                year = s.first_air_date.take(4),
                                subject = null,
                                tmdbId = s.id,
                            )
                        )
                    }
                }
                    .sortedByDescending { it.rating ?: 0.0 }
                    .take(10)

                HomeSection(
                    key = provider.name,
                    label = provider.label,
                    brandColor = provider.brandColor,
                    isSeries = false,
                    cards = cards,
                    heroTitle = meta.title,
                    heroYear = meta.year,
                    heroRating = meta.rating,
                    rtScore = meta.rtScore,
                    overview = meta.overview,
                    heroBackdropUrl = backdrop ?: meta.backdropAsset,
                    heroLogoUrl = logoUrl,
                    logoAsset = provider.asset,
                    backdropOffsetX = if (provider == WatchProviderKey.DISNEYPLUS) -48f else 0f,
                )
            }.filterNotNull()

            _state.value = StreamingSitesState(sections = sections, loading = false)
        }
    }
}
