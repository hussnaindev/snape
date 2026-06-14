package com.snape.flix.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectGroup
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

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

class SearchViewModel : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private val _picker = MutableStateFlow<PickerState>(PickerState.Hidden)
    val picker: StateFlow<PickerState> = _picker.asStateFlow()

    private var searchJob: Job? = null
    private var loadMoreJob: Job? = null
    private var page = 1

    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query) }
        searchJob?.cancel()
        loadMoreJob?.cancel()
        page = 1
        if (query.isBlank()) {
            _state.update {
                it.copy(results = emptyList(), loading = false, loadingMore = false, error = null, searched = false, canLoadMore = false)
            }
            return
        }
        searchJob = viewModelScope.launch {
            delay(350) // debounce keystrokes
            _state.update { it.copy(loading = true, error = null) }
            runCatching { MovieBoxRepository.search(query, page = 1) }
                .onSuccess { pageResult ->
                    _state.update {
                        it.copy(
                            loading = false,
                            results = pageResult.groups,
                            searched = true,
                            error = null,
                            canLoadMore = pageResult.hasMore,
                        )
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Search failed", searched = true, canLoadMore = false)
                    }
                }
        }
    }

    /** Fetch the next page and append it (deduping by subjectId). */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || !s.canLoadMore || s.query.isBlank()) return
        if (loadMoreJob?.isActive == true) return
        loadMoreJob = viewModelScope.launch {
            _state.update { it.copy(loadingMore = true) }
            val next = page + 1
            runCatching { MovieBoxRepository.search(s.query, page = next) }
                .onSuccess { pageResult ->
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
                }
                .onFailure {
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
