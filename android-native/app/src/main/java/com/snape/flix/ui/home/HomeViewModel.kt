package com.snape.flix.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.HomePrefetch
import com.snape.flix.data.HomeSection
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SubjectGroup
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val sections: List<HomeSection> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

class HomeViewModel : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    private val _resolving = MutableStateFlow(false)
    val resolving: StateFlow<Boolean> = _resolving.asStateFlow()

    init { load() }

    fun load() {
        // The catalogue is loaded by [HomePrefetch] (kicked off at launch, in
        // parallel with the access check). It's almost always already complete by
        // the time the home screen is shown, so this just reflects the result;
        // if it isn't started yet, start() begins it and we show the spinner.
        _state.update { it.copy(loading = _state.value.sections.isEmpty(), error = null) }
        viewModelScope.launch {
            val sections = runCatching { HomePrefetch.start().await() }.getOrElse { e ->
                _state.update { st ->
                    if (st.sections.isEmpty()) st.copy(loading = false, error = e.message ?: "Failed to load home")
                    else st.copy(loading = false)
                }
                return@launch
            }
            _state.update { it.copy(sections = sections, loading = false, error = null) }
        }
    }

    /**
     * Resolve a title (TMDB-sourced card or hero button) to a playable MovieBox
     * subject via search, then open it. Shows a brief resolving overlay.
     */
    fun resolveAndOpen(title: String, onOpen: (SubjectGroup) -> Unit, onFail: () -> Unit = {}) {
        viewModelScope.launch {
            _resolving.value = true
            val group = runCatching { MovieBoxRepository.search(title, page = 1).groups.firstOrNull() }
                .getOrNull()
            _resolving.value = false
            if (group != null) onOpen(group) else onFail()
        }
    }
}
