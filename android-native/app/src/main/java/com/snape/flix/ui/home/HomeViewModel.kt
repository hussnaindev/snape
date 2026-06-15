package com.snape.flix.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.HomeRepository
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
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val base = runCatching { HomeRepository.buildSections() }.getOrElse { e ->
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load home") }
                return@launch
            }
            // Render cards immediately; fade hero metadata in as TMDB resolves.
            _state.update { it.copy(sections = base, loading = false, error = null) }
            for (section in base) {
                launch {
                    val enriched = runCatching { HomeRepository.enrichHero(section) }.getOrDefault(section)
                    _state.update { st ->
                        val list = st.sections.toMutableList()
                        val i = list.indexOfFirst { it.key == enriched.key }
                        if (i >= 0) list[i] = enriched
                        st.copy(sections = list)
                    }
                }
            }
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
