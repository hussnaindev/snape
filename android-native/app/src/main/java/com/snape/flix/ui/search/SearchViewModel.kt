package com.snape.flix.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectItem
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
    val results: List<SubjectItem> = emptyList(),
    val error: String? = null,
    val searched: Boolean = false,
)

sealed interface PickerState {
    data object Hidden : PickerState
    data class Loading(val item: SubjectItem) : PickerState
    data class Ready(val item: SubjectItem, val seasons: List<SeasonItem>) : PickerState
    data class Error(val item: SubjectItem, val message: String) : PickerState
}

class SearchViewModel : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private val _picker = MutableStateFlow<PickerState>(PickerState.Hidden)
    val picker: StateFlow<PickerState> = _picker.asStateFlow()

    private var searchJob: Job? = null

    /** Debounced search — only updates [SearchUiState.query] when a fetch actually runs. */
    fun search(query: String) {
        searchJob?.cancel()
        if (query.isBlank()) {
            _state.update { it.copy(query = "", results = emptyList(), loading = false, error = null, searched = false) }
            return
        }
        searchJob = viewModelScope.launch {
            delay(350)
            _state.update { it.copy(query = query, loading = true, error = null) }
            runCatching { MovieBoxRepository.search(query) }
                .onSuccess { items ->
                    _state.update {
                        it.copy(loading = false, results = items, searched = true, error = null)
                    }
                }
                .onFailure { e ->
                    _state.update {
                        it.copy(loading = false, error = e.message ?: "Search failed", searched = true)
                    }
                }
        }
    }

    fun openSeries(item: SubjectItem) {
        _picker.value = PickerState.Loading(item)
        viewModelScope.launch {
            runCatching { MovieBoxRepository.seasonInfo(item.subjectId) }
                .onSuccess { seasons ->
                    _picker.value = if (seasons.isEmpty()) {
                        // Fall back to a single-season guess so the title is still playable.
                        PickerState.Ready(item, listOf(SeasonItem(se = 1, maxEp = 1)))
                    } else {
                        PickerState.Ready(item, seasons)
                    }
                }
                .onFailure { e ->
                    _picker.value = PickerState.Error(item, e.message ?: "Could not load episodes")
                }
        }
    }

    fun closePicker() {
        _picker.value = PickerState.Hidden
    }
}
