package com.snape.flix.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.Caption
import com.snape.flix.data.MovieBoxRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface DownloadState {
    data object Loading : DownloadState
    data object Unavailable : DownloadState
    data class Ready(
        val url: String,
        val signCookie: String,
        val format: String,
        val qualities: List<String>,
        val subtitles: List<Caption>,
    ) : DownloadState
}

/** Resolves the playable stream + captions for the download sheet's chosen variant. */
class DownloadViewModel : ViewModel() {

    private val _state = MutableStateFlow<DownloadState>(DownloadState.Loading)
    val state: StateFlow<DownloadState> = _state.asStateFlow()

    private var key: String? = null

    fun load(subjectId: String, se: Int, ep: Int) {
        val k = "$subjectId/$se/$ep"
        if (k == key) return
        key = k
        _state.value = DownloadState.Loading
        viewModelScope.launch {
            val stream = runCatching { MovieBoxRepository.playInfo(subjectId, se, ep) }.getOrNull()
            if (stream == null || stream.url.isBlank()) {
                _state.value = DownloadState.Unavailable
                return@launch
            }
            val captions = runCatching { MovieBoxRepository.captions(subjectId, se, ep) }
                .getOrDefault(emptyList())
            val qualities = stream.resolutions
                .split(",")
                .mapNotNull { it.trim().toIntOrNull() }
                .distinct()
                .sortedDescending()
                .map { "${it}p" }
            _state.value = DownloadState.Ready(
                url = stream.url,
                signCookie = stream.signCookie,
                format = stream.format,
                qualities = qualities,
                subtitles = captions,
            )
        }
    }
}
