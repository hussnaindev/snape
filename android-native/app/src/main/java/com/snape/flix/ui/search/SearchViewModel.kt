package com.snape.flix.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectGroup
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
    val results: List<SubjectGroup> = emptyList(),
    val error: String? = null,
    val searched: Boolean = false,
    val canLoadMore: Boolean = false,
)

sealed interface PickerState {
    data object Hidden : PickerState
    data class Loading(val group: SubjectGroup) : PickerState
    data class Ready(val group: SubjectGroup, val seasons: List<SeasonItem>) : PickerState
    data class Error(val group: SubjectGroup, val message: String) : PickerState
}

/** Debounce window for live search-as-you-type (standard SaaS-grade ~300ms). */
private const val DEBOUNCE_MS = 300L

@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class SearchViewModel : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private val _picker = MutableStateFlow<PickerState>(PickerState.Hidden)
    val picker: StateFlow<PickerState> = _picker.asStateFlow()

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
            // Clear instantly — don't wait on the debounce — and stop any paging.
            loadMoreJob?.cancel()
            _state.update {
                it.copy(results = emptyList(), loading = false, loadingMore = false, error = null, searched = false, canLoadMore = false)
            }
        }
        queryInput.value = query
    }

    /**
     * Emits nothing; drives [_state] for one query. Cancellation (a newer
     * keystroke) is rethrown so it never surfaces as a user-facing error — the
     * previous bug where typing/deleting flashed "coroutine cancelled".
     */
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
            val pageResult = MovieBoxRepository.search(query, page = 1)
            _state.update {
                it.copy(
                    loading = false,
                    results = pageResult.groups,
                    searched = true,
                    error = null,
                    canLoadMore = pageResult.hasMore,
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

    /**
     * Fetch the next page and append it (deduping by subjectId). The grid keeps
     * calling this on scroll until [SearchUiState.canLoadMore] is false, so the
     * full result set is paged in — not capped at the first page.
     */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || !s.canLoadMore || s.query.isBlank()) return
        if (loadMoreJob?.isActive == true) return
        loadMoreJob = viewModelScope.launch {
            _state.update { it.copy(loadingMore = true) }
            val next = page + 1
            try {
                val pageResult = MovieBoxRepository.search(s.query, page = next)
                page = next
                val existing = _state.value.results.mapTo(HashSet()) { it.primary.subjectId }
                val fresh = pageResult.groups.filter { it.primary.subjectId !in existing }
                _state.update {
                    it.copy(
                        loadingMore = false,
                        results = it.results + fresh,
                        canLoadMore = pageResult.hasMore,
                    )
                }
            } catch (ce: CancellationException) {
                _state.update { it.copy(loadingMore = false) }
                throw ce
            } catch (_: Exception) {
                // Keep what we have; stop trying so we don't loop on a bad page.
                _state.update { it.copy(loadingMore = false, canLoadMore = false) }
            }
        }
    }

    fun openSeries(group: SubjectGroup) {
        _picker.value = PickerState.Loading(group)
        viewModelScope.launch {
            runCatching { MovieBoxRepository.seasonInfo(group.primary.subjectId) }
                .onSuccess { seasons ->
                    _picker.value = if (seasons.isEmpty()) {
                        // Fall back to a single-season guess so the title is still playable.
                        PickerState.Ready(group, listOf(SeasonItem(se = 1, maxEp = 1)))
                    } else {
                        PickerState.Ready(group, seasons)
                    }
                }
                .onFailure { e ->
                    _picker.value = PickerState.Error(group, e.message ?: "Could not load episodes")
                }
        }
    }

    fun closePicker() {
        _picker.value = PickerState.Hidden
    }
}
