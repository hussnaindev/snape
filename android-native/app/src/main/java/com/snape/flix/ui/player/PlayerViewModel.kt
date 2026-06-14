package com.snape.flix.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.Caption
import com.snape.flix.data.MovieBoxRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface PlayerLoadState {
    data object Loading : PlayerLoadState
    data class Ready(
        val mpdUrl: String,
        val signCookie: String,
        val format: String,
        val captions: List<Caption>,
        val qualities: List<Int>, // heights, descending; empty => auto only
    ) : PlayerLoadState

    data class Error(val message: String) : PlayerLoadState
}

class PlayerViewModel : ViewModel() {

    private val _state = MutableStateFlow<PlayerLoadState>(PlayerLoadState.Loading)
    val state: StateFlow<PlayerLoadState> = _state.asStateFlow()

    private var currentKey: String? = null
    private var job: Job? = null

    /**
     * Load (or reload) a stream. Calling again with a different subjectId — e.g.
     * the user picked another audio variant — refetches and swaps the stream.
     */
    fun load(subjectId: String, se: Int, ep: Int) {
        val key = "$subjectId/$se/$ep"
        if (key == currentKey) return
        currentKey = key
        job?.cancel()
        _state.value = PlayerLoadState.Loading
        job = viewModelScope.launch {
            runCatching {
                // Stream is required; captions are best-effort and fetched in parallel.
                val streamDeferred = async { MovieBoxRepository.playInfo(subjectId, se, ep) }
                val captionsDeferred = async { MovieBoxRepository.captions(subjectId, se, ep) }
                val stream = streamDeferred.await()
                    ?: return@runCatching PlayerLoadState.Error("No playable stream found.")
                val captions = captionsDeferred.await()
                val qualities = stream.resolutions
                    .split(",")
                    .mapNotNull { it.trim().toIntOrNull() }
                    .distinct()
                    .sortedDescending()
                PlayerLoadState.Ready(stream.url, stream.signCookie, stream.format, captions, qualities)
            }.onSuccess { _state.value = it }
                .onFailure { _state.value = PlayerLoadState.Error(it.message ?: "Playback failed.") }
        }
    }
}
