package com.snape.flix.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectGroup
import com.snape.flix.data.SubjectItem
import com.snape.flix.data.TmdbCastMember
import com.snape.flix.data.TmdbEpisode
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.data.TmdbSeasonSummary
import com.snape.flix.data.WatchProviderKey
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The merged detail-page model. MovieBox supplies the base (it is the playable
 * source); TMDB fields fill in once resolved. The screen renders the MovieBox
 * base immediately and the TMDB fields stream in, so the page never blocks.
 */
data class DetailUiState(
    val group: SubjectGroup,
    val isSeries: Boolean,
    val title: String,
    val year: String,
    val rating: Double?,
    val runtimeLabel: String?,
    val genres: List<String>,
    val overview: String,
    val posterUrl: String?,
    // TMDB enrichment ↓
    val backdropUrl: String? = null,
    val logoUrl: String? = null,
    val trailerKey: String? = null,
    val tagline: String? = null,
    val cast: List<TmdbCastMember> = emptyList(),
    val recommendations: List<TmdbSearchHit> = emptyList(),
    val providers: List<WatchProviderKey> = emptyList(),
    // series ↓
    val statusLabel: String? = null,
    val seasonsCountLabel: String? = null,
    val creators: String? = null,
    val networks: String? = null,
    val seasons: List<TmdbSeasonSummary> = emptyList(),
    val episodesBySeason: Map<Int, List<TmdbEpisode>> = emptyMap(),
    val playableSeasons: List<SeasonItem> = emptyList(),
    val enriching: Boolean = true,
    val refreshing: Boolean = false,
)

class DetailViewModel : ViewModel() {

    private val _state = MutableStateFlow<DetailUiState?>(null)
    val state: StateFlow<DetailUiState?> = _state.asStateFlow()

    private var tmdbId: Int? = null
    private var started = false

    fun start(group: SubjectGroup) {
        if (started) return
        started = true
        _state.value = baseState(group, group.primary)
        enrich(group)
    }

    /** Pull-to-refresh: re-resolve and refetch TMDB enrichment, keeping the page up. */
    fun refresh() {
        val cur = _state.value ?: return
        if (cur.refreshing) return
        _state.update { it?.copy(refreshing = true) }
        enrich(cur.group)
    }

    private fun enrich(group: SubjectGroup) {
        val p = group.primary
        viewModelScope.launch {
            // Resolve the matching TMDB id, then fan out the enrichment calls.
            val id = TmdbRepository.resolveId(p.isSeries, p.title, p.year) ?: run {
                _state.update { it?.copy(enriching = false, refreshing = false) }
                if (p.isSeries) loadPlayableSeasons(group)
                return@launch
            }
            tmdbId = id

            val detailDeferred = async { TmdbRepository.detail(p.isSeries, id) }
            val castDeferred = async { TmdbRepository.cast(p.isSeries, id) }
            val logoDeferred = async { TmdbRepository.logoUrl(p.isSeries, id) }
            val trailerDeferred = async { TmdbRepository.trailerKey(p.isSeries, id) }
            val providersDeferred = async { TmdbRepository.watchProviders(p.isSeries, id) }

            val detail = detailDeferred.await()
            val cast = castDeferred.await()
            val logo = logoDeferred.await()
            val trailer = trailerDeferred.await()
            val providers = providersDeferred.await()

            val genreIds = detail?.genres?.map { it.id } ?: emptyList()
            val recs = TmdbRepository.recommendations(p.isSeries, id, genreIds)

            _state.update { cur ->
                cur ?: return@update null
                cur.copy(
                    backdropUrl = TmdbRepository.img(detail?.backdrop_path, "w1280"),
                    logoUrl = logo,
                    trailerKey = trailer,
                    tagline = detail?.tagline?.ifBlank { null },
                    cast = cast,
                    recommendations = recs,
                    providers = providers,
                    // Prefer MovieBox values; fall back to TMDB where MovieBox is blank.
                    overview = cur.overview.ifBlank { detail?.overview.orEmpty() },
                    genres = if (cur.genres.isNotEmpty()) cur.genres
                    else detail?.genres?.map { it.name } ?: emptyList(),
                    rating = cur.rating ?: detail?.vote_average?.takeIf { it > 0 },
                    runtimeLabel = cur.runtimeLabel ?: formatRuntime(detail?.runtime),
                    statusLabel = detail?.status?.ifBlank { null },
                    seasonsCountLabel = detail?.number_of_seasons
                        ?.takeIf { it > 0 }
                        ?.let { "$it ${if (it == 1) "Season" else "Seasons"}" },
                    creators = detail?.created_by?.take(3)?.joinToString(", ") { it.name }
                        ?.ifBlank { null },
                    networks = detail?.networks?.joinToString(" · ") { it.name }?.ifBlank { null },
                    seasons = detail?.seasons
                        ?.filter { it.season_number != 0 && it.episode_count > 0 }
                        ?: emptyList(),
                    enriching = false,
                    refreshing = false,
                )
            }

            if (p.isSeries) {
                loadPlayableSeasons(group)
                // Pre-load the first visible season's episodes for the carousel.
                _state.value?.seasons?.firstOrNull()?.let { loadSeason(it.season_number) }
            }
        }
    }

    /** Lazily fetch a TMDB season's episodes when its tab is selected. */
    fun loadSeason(seasonNumber: Int) {
        val id = tmdbId ?: return
        val cur = _state.value ?: return
        if (cur.episodesBySeason.containsKey(seasonNumber)) return
        viewModelScope.launch {
            val eps = TmdbRepository.season(id, seasonNumber)
            _state.update { s ->
                s?.copy(episodesBySeason = s.episodesBySeason + (seasonNumber to eps))
            }
        }
    }

    private suspend fun loadPlayableSeasons(group: SubjectGroup) {
        val seasons = runCatching { MovieBoxRepository.seasonInfo(group.primary.subjectId) }
            .getOrDefault(emptyList())
        _state.update { it?.copy(playableSeasons = seasons) }
    }

    private fun baseState(group: SubjectGroup, p: SubjectItem) = DetailUiState(
        group = group,
        isSeries = p.isSeries,
        title = cleanTitle(p.title),
        year = p.year,
        rating = p.rating,
        runtimeLabel = if (!p.isSeries) p.duration.ifBlank { null } else null,
        genres = p.genre.split(",").map { it.trim() }.filter { it.isNotEmpty() },
        overview = p.description,
        posterUrl = p.posterUrl,
    )

    private fun cleanTitle(title: String): String =
        title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim()

    private fun formatRuntime(minutes: Int?): String? {
        if (minutes == null || minutes <= 0) return null
        val h = minutes / 60
        val m = minutes % 60
        return if (h > 0) "${h}h ${m}m" else "${m}m"
    }
}
