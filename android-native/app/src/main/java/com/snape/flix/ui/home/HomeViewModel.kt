package com.snape.flix.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.HomeRepository
import com.snape.flix.data.HomeSection
import com.snape.flix.data.TmdbRef
import com.snape.flix.data.TmdbRepository
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
     * The hero slides are hard-coded brand titles with no TMDB id, so look the
     * title up on TMDB first, then open the detail page by ref (which resolves the
     * MovieBox match). A brief overlay covers the quick TMDB lookup.
     */
    fun openHeroTitle(title: String, isSeries: Boolean, onOpen: (TmdbRef) -> Unit, onFail: () -> Unit = {}) {
        viewModelScope.launch {
            _resolving.value = true
            val hits = runCatching { TmdbRepository.searchMulti(title) }.getOrNull().orEmpty()
            val hit = hits.firstOrNull { it.isSeries == isSeries } ?: hits.firstOrNull()
            _resolving.value = false
            if (hit != null) onOpen(hit.toRef()) else onFail()
        }
    }
}
