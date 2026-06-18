package com.snape.flix.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.TmdbSearchHit
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException

data class SearchUiState(
    val query: String = "",
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val results: List<TmdbSearchHit> = emptyList(),
    val error: String? = null,
    val searched: Boolean = false,
    val canLoadMore: Boolean = false,
)

/** Debounce window for live search-as-you-type (standard SaaS-grade ~300ms). */
private const val DEBOUNCE_MS = 300L
/** TMDB returns ~20 results/page. */
private const val PAGE_SIZE = 20

/**
 * Search is TMDB-first: the grid shows TMDB hits (movies + series, released only);
 * the playable MovieBox match is resolved later, when a result is opened on the
 * detail page. Series no longer need an inline episode picker — the detail page
 * owns season/episode selection.
 */
@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class SearchViewModel : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    // The raw, every-keystroke query. The pipeline below debounces it, drops
    // duplicates, and runs at most one search at a time — a newer keystroke
    // cancels the in-flight search via flatMapLatest, so no stale page ever lands.
    private val queryInput = MutableStateFlow("")
    private var loadMoreJob: Job? = null
    private var page = 1

    init {
        queryInput
            .debounce { if (it.isBlank()) 0L else DEBOUNCE_MS }
            .distinctUntilChanged()
            .flatMapLatest { q -> runSearch(q) }
            .launchIn(viewModelScope)
    }

    /** Update the field immediately; the debounced pipeline drives the results. */
    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query) }
        if (query.isBlank()) {
            loadMoreJob?.cancel()
            _state.update {
                it.copy(results = emptyList(), loading = false, loadingMore = false, error = null, searched = false, canLoadMore = false)
            }
        }
        queryInput.value = query
    }

    private fun runSearch(query: String): Flow<Unit> = flow {
        loadMoreJob?.cancel()
        page = 1
        if (query.isBlank()) {
            _state.update {
                it.copy(results = emptyList(), loading = false, loadingMore = false, error = null, searched = false, canLoadMore = false)
            }
            return@flow
        }
        _state.update { it.copy(loading = true, error = null) }
        try {
            val hits = TmdbRepository.searchMulti(query, page = 1)
            _state.update {
                it.copy(
                    loading = false,
                    results = hits,
                    searched = true,
                    error = null,
                    canLoadMore = hits.size >= PAGE_SIZE,
                )
            }
        } catch (ce: CancellationException) {
            throw ce // superseded by a newer query — silent, not an error
        } catch (e: Exception) {
            _state.update {
                it.copy(loading = false, error = e.message ?: "Search failed", searched = true, canLoadMore = false)
            }
        }
    }

    /** Fetch the next page and append it (deduping by id+type). */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || !s.canLoadMore || s.query.isBlank()) return
        if (loadMoreJob?.isActive == true) return
        loadMoreJob = viewModelScope.launch {
            _state.update { it.copy(loadingMore = true) }
            val next = page + 1
            try {
                val hits = TmdbRepository.searchMulti(s.query, page = next)
                page = next
                val existing = _state.value.results.mapTo(HashSet()) { it.id to it.isSeries }
                val fresh = hits.filter { (it.id to it.isSeries) !in existing }
                _state.update {
                    it.copy(
                        loadingMore = false,
                        results = it.results + fresh,
                        canLoadMore = hits.size >= PAGE_SIZE,
                    )
                }
            } catch (ce: CancellationException) {
                _state.update { it.copy(loadingMore = false) }
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(loadingMore = false, canLoadMore = false) }
            }
        }
    }
}
