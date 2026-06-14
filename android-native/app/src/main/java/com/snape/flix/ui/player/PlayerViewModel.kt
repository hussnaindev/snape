package com.snape.flix.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.snape.flix.data.Caption
import com.snape.flix.data.MovieBoxRepository
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
        val captions: List<Caption>,
        val qualities: List<Int>, // heights, descending; empty => auto only
    ) : PlayerLoadState

    data class Error(val message: String) : PlayerLoadState
}

class PlayerViewModel : ViewModel() {

    private val _state = MutableStateFlow<PlayerLoadState>(PlayerLoadState.Loading)
    val state: StateFlow<PlayerLoadState> = _state.asStateFlow()

    private var started = false

    fun load(subjectId: String, se: Int, ep: Int) {
        if (started) return
        started = true
        viewModelScope.launch {
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
                PlayerLoadState.Ready(stream.url, stream.signCookie, captions, qualities)
            }.onSuccess { _state.value = it }
                .onFailure { _state.value = PlayerLoadState.Error(it.message ?: "Playback failed.") }
        }
    }
}
