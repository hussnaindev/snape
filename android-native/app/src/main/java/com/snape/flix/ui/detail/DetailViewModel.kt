package com.snape.flix.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectGroup
import com.snape.flix.data.SubjectItem
import com.snape.flix.data.TmdbCastMember
import com.snape.flix.data.TmdbEpisode
import com.snape.flix.data.TmdbRef
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.data.TmdbSeasonSummary
import com.snape.flix.data.WatchProviderKey
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The merged detail-page model. TMDB is the catalogue/source of truth: the page
 * is opened with a [TmdbRef] and TMDB supplies all the displayed metadata. In
 * parallel, the ref is resolved to a playable MovieBox [group] (primary + ordered
 * audio variants). The screen stays on its skeleton until BOTH the TMDB enrichment
 * and the MovieBox resolve have finished — so when it renders, [group] is either
 * present (play is instant) or null ([unavailable] = no streamable match).
 */
data class DetailUiState(
    val group: SubjectGroup?, // null until/unless a MovieBox match resolves
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
    // true once resolve has finished with no MovieBox match (browsable, not playable)
    val unavailable: Boolean = false,
)

class DetailViewModel : ViewModel() {

    private val _state = MutableStateFlow<DetailUiState?>(null)
    val state: StateFlow<DetailUiState?> = _state.asStateFlow()

    private var tmdbId: Int? = null
    private var started = false

    /** Primary entry: TMDB-first. Enrich + resolve the MovieBox match in parallel. */
    fun start(ref: TmdbRef) {
        if (started) return
        started = true
        tmdbId = ref.id
        _state.value = baseStateFromRef(ref)

        viewModelScope.launch {
            // Fire the MovieBox resolve and the TMDB metadata calls concurrently;
            // enrich awaits the resolve only at the end.
            val resolveDeferred = async { MovieBoxRepository.resolve(ref) }
            enrich(ref.id, ref.isSeries, resolveDeferred)
        }
    }

    /**
     * Replay entry (watchlist / Continue Watching): we already hold a resolved
     * MovieBox subject, so playback is available instantly. Enrich from TMDB, and
     * if we only carry the single stored variant, expand to the full audio-variant
     * set in the background (cheap — the resolve is cached).
     */
    fun start(group: SubjectGroup) {
        if (started) return
        started = true
        val p = group.primary
        _state.value = baseStateFromSubject(group, p)

        viewModelScope.launch {
            val id = p.tmdbId ?: TmdbRepository.resolveId(p.isSeries, p.title, p.year)
            if (id == null) {
                _state.update { it?.copy(enriching = false) }
                if (p.isSeries) loadPlayableSeasons(group)
                return@launch
            }
            tmdbId = id
            // Playback is already available (stored group). In the background expand
            // to the full audio-variant set if we only carry the single stored one;
            // run it concurrently with enrichment, falling back to the stored group.
            val groupDeferred = async {
                if (group.variants.size <= 1) {
                    runCatching {
                        MovieBoxRepository.resolve(
                            TmdbRef(id, p.isSeries, cleanTitle(p.title), p.year, posterUrl = p.posterUrl),
                        )
                    }.getOrNull() ?: group
                } else {
                    group
                }
            }
            enrich(id, p.isSeries, groupDeferred)
        }
    }

    /** Fan out the TMDB enrichment calls and patch them, awaiting the (concurrent)
     *  MovieBox resolve only at the end. */
    private suspend fun enrich(id: Int, isSeries: Boolean, groupDeferred: Deferred<SubjectGroup?>) {
        val detailDeferred = viewModelScope.async { TmdbRepository.detail(isSeries, id) }
        val castDeferred = viewModelScope.async { TmdbRepository.cast(isSeries, id) }
        val logoDeferred = viewModelScope.async { TmdbRepository.logoUrl(isSeries, id) }
        val trailerDeferred = viewModelScope.async { TmdbRepository.trailerKey(isSeries, id) }
        val providersDeferred = viewModelScope.async { TmdbRepository.watchProviders(isSeries, id) }

        val detail = detailDeferred.await()
        val cast = castDeferred.await()
        val logo = logoDeferred.await()
        val trailer = trailerDeferred.await()
        val providers = providersDeferred.await()

        val genreIds = detail?.genres?.map { it.id } ?: emptyList()
        val recs = TmdbRepository.recommendations(isSeries, id, genreIds)
        val group = groupDeferred.await()

        _state.update { cur ->
            cur ?: return@update null
            cur.copy(
                group = group ?: cur.group,
                unavailable = group == null && cur.group == null,
                backdropUrl = TmdbRepository.img(detail?.backdrop_path, "w1280"),
                logoUrl = logo,
                trailerKey = trailer,
                tagline = detail?.tagline?.ifBlank { null },
                cast = cast,
                recommendations = recs,
                providers = providers,
                // Prefer existing values; fall back to TMDB where blank.
                overview = cur.overview.ifBlank { detail?.overview.orEmpty() },
                genres = if (cur.genres.isNotEmpty()) cur.genres
                else detail?.genres?.map { it.name } ?: emptyList(),
                rating = cur.rating ?: detail?.vote_average?.takeIf { it > 0 },
                runtimeLabel = cur.runtimeLabel ?: formatRuntime(detail?.runtime),
                statusLabel = detail?.status?.ifBlank { null },
                seasonsCountLabel = detail?.number_of_seasons
                    ?.takeIf { it > 0 }
                    ?.let { "$it ${if (it == 1) "Season" else "Seasons"}" },
                creators = detail?.created_by?.take(3)?.joinToString(", ") { it.name }?.ifBlank { null },
                networks = detail?.networks?.joinToString(" · ") { it.name }?.ifBlank { null },
                seasons = detail?.seasons?.filter { it.season_number != 0 && it.episode_count > 0 } ?: emptyList(),
                enriching = false,
            )
        }

        val resolved = _state.value?.group
        if (isSeries && resolved != null) {
            loadPlayableSeasons(resolved)
            _state.value?.seasons?.firstOrNull()?.let { loadSeason(it.season_number) }
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

    private fun baseStateFromRef(ref: TmdbRef) = DetailUiState(
        group = null,
        isSeries = ref.isSeries,
        title = cleanTitle(ref.title),
        year = ref.year,
        rating = ref.voteAverage?.takeIf { it > 0 },
        runtimeLabel = null,
        genres = emptyList(),
        overview = "",
        posterUrl = ref.posterUrl,
    )

    private fun baseStateFromSubject(group: SubjectGroup, p: SubjectItem) = DetailUiState(
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
