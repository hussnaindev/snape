package com.snape.flix.ui.browse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.TmdbSearchHit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProviderBrowseState(
    val movies: List<TmdbSearchHit> = emptyList(),
    val series: List<TmdbSearchHit> = emptyList(),
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val refreshing: Boolean = false,
    val moviePage: Int = 1,
    val seriesPage: Int = 1,
    val hasMore: Boolean = true,
)

class ProviderBrowseViewModel : ViewModel() {

    private val _state = MutableStateFlow(ProviderBrowseState())
    val state: StateFlow<ProviderBrowseState> = _state.asStateFlow()

    private var providerId = 0
    private var loaded = false

    fun start(providerId: Int) {
        if (loaded) return
        loaded = true
        this.providerId = providerId
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            val movies = runCatching { TmdbRepository.discoverMoviesByProvider(providerId, page = 1) }.getOrDefault(emptyList())
            val series = runCatching { TmdbRepository.discoverSeriesByProvider(providerId, page = 1) }.getOrDefault(emptyList())
            _state.value = ProviderBrowseState(
                movies = movies,
                series = series,
                loading = false,
                hasMore = movies.size >= 20 || series.size >= 20,
            )
        }
    }

    /** Pull-to-refresh: refetch page 1 fresh, keeping current content visible. */
    fun refresh() {
        if (!loaded || _state.value.refreshing) return
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            val movies = runCatching { TmdbRepository.discoverMoviesByProvider(providerId, page = 1) }.getOrDefault(emptyList())
            val series = runCatching { TmdbRepository.discoverSeriesByProvider(providerId, page = 1) }.getOrDefault(emptyList())
            _state.update {
                if (movies.isEmpty() && series.isEmpty()) it.copy(refreshing = false)
                else ProviderBrowseState(
                    movies = movies,
                    series = series,
                    loading = false,
                    hasMore = movies.size >= 20 || series.size >= 20,
                )
            }
        }
    }

    fun loadMore() {
        val cur = _state.value
        if (cur.loadingMore || !cur.hasMore) return
        _state.value = cur.copy(loadingMore = true)
        viewModelScope.launch {
            val nextMoviePage = cur.moviePage + 1
            val nextSeriesPage = cur.seriesPage + 1

            val newMovies = runCatching { TmdbRepository.discoverMoviesByProvider(providerId, page = nextMoviePage) }.getOrDefault(emptyList())
            val newSeries = runCatching { TmdbRepository.discoverSeriesByProvider(providerId, page = nextSeriesPage) }.getOrDefault(emptyList())

            _state.value = _state.value.copy(
                movies = _state.value.movies + newMovies,
                series = _state.value.series + newSeries,
                moviePage = nextMoviePage,
                seriesPage = nextSeriesPage,
                hasMore = newMovies.size >= 20 || newSeries.size >= 20,
                loadingMore = false,
            )
        }
    }
}
