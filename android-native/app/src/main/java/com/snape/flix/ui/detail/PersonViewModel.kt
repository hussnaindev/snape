package com.snape.flix.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.TmdbPerson
import com.snape.flix.data.TmdbPersonCredit
import com.snape.flix.data.TmdbRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Drives the person/actor page — a native replica of the web `app/person/[id]`.
 * Fetches the person + movie/TV credits straight from TMDB on-device, then derives
 * the hero backdrop/trailer, the "Known For" rail (top 8 by popularity) and the
 * full filmography (films with images, newest first). The filmography is paged
 * client-side ([displayCount]) so the grid loads more as the user scrolls, like
 * the search/browse grids.
 */
data class PersonUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val person: TmdbPerson? = null,
    val backdropUrl: String? = null,
    val trailerKey: String? = null,
    val knownFor: List<TmdbPersonCredit> = emptyList(),
    val filmography: List<TmdbPersonCredit> = emptyList(),
    val displayCount: Int = PAGE,
) {
    /** Filmography slice currently visible in the grid. */
    val visibleFilmography: List<TmdbPersonCredit>
        get() = filmography.take(displayCount)

    val canLoadMore: Boolean get() = displayCount < filmography.size

    companion object {
        const val PAGE = 18
    }
}

class PersonViewModel : ViewModel() {

    private val _state = MutableStateFlow(PersonUiState())
    val state: StateFlow<PersonUiState> = _state.asStateFlow()

    private var started = false

    fun start(personId: Int) {
        if (started) return
        started = true

        viewModelScope.launch {
            val personDeferred = async { TmdbRepository.person(personId) }
            val movieDeferred = async { TmdbRepository.personMovieCredits(personId) }
            val seriesDeferred = async { TmdbRepository.personSeriesCredits(personId) }

            val person = personDeferred.await()
            val movieCredits = movieDeferred.await()
            val seriesCredits = seriesDeferred.await()

            if (person == null) {
                _state.update { it.copy(loading = false, error = "Couldn't load this person.") }
                return@launch
            }

            // Known for: top 8 films by popularity (same image rule as the homepage).
            val knownFor = movieCredits
                .filter { it.hasImages }
                .sortedByDescending { it.popularity }
                .take(8)

            // Full filmography: films with images and a release date, newest first.
            val filmography = movieCredits
                .filter { it.hasImages && it.date.isNotBlank() }
                .sortedByDescending { it.date }

            // Hero backdrop: latest movie OR series credit that has a backdrop.
            val heroCredit = (movieCredits + seriesCredits)
                .filter { !it.backdrop_path.isNullOrBlank() && it.date.isNotBlank() }
                .maxByOrNull { it.date }

            _state.update {
                it.copy(
                    loading = false,
                    person = person,
                    knownFor = knownFor,
                    filmography = filmography,
                    backdropUrl = TmdbRepository.img(heroCredit?.backdrop_path, "w1280"),
                )
            }

            // Trailer for the hero title — streams in after the page is shown.
            heroCredit?.let { credit ->
                val isSeries = credit.title.isBlank() && credit.name.isNotBlank()
                val key = TmdbRepository.trailerKey(isSeries, credit.id)
                if (key != null) _state.update { it.copy(trailerKey = key) }
            }
        }
    }

    /** Reveal the next page of filmography rows as the user scrolls near the end. */
    fun loadMore() {
        _state.update {
            if (it.displayCount >= it.filmography.size) it
            else it.copy(displayCount = (it.displayCount + PersonUiState.PAGE).coerceAtMost(it.filmography.size))
        }
    }
}
