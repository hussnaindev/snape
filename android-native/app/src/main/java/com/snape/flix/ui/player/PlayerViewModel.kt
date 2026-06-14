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
        val subjectId: String, // the variant that actually resolved to a stream
        val mpdUrl: String,
        val signCookie: String,
        val format: String, // "DASH" | "HLS" | "MP4" — drives the player's MIME type
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
     * Load a stream, trying [candidates] (in order) until one yields a playable
     * stream. The mobile BFF reports `hasResource:true` in search for variants
     * whose play-info nonetheless returns *zero* streams — e.g. an un-dubbed
     * original where only the Hindi track is wired up on the play side. Rather
     * than dead-end on "No playable stream found", we fall back to the next
     * variant; the caller orders [candidates] by preference (Original → English
     * → Hindi → …). [PlayerLoadState.Ready.subjectId] reports which one won so
     * the UI's audio menu can reflect what's actually playing.
     */
    fun load(candidates: List<AudioVariant>, se: Int, ep: Int) {
        val key = candidates.joinToString(",") { it.id } + "/$se/$ep"
        if (key == currentKey) return
        currentKey = key
        job?.cancel()
        _state.value = PlayerLoadState.Loading
        job = viewModelScope.launch {
            runCatching {
                for (variant in candidates) {
                    // Stream is required; captions are best-effort, fetched in
                    // parallel for the same variant and dropped if it has no stream.
                    val streamDeferred = async { MovieBoxRepository.playInfo(variant.id, se, ep) }
                    val captionsDeferred = async { MovieBoxRepository.captions(variant.id, se, ep) }
                    val stream = streamDeferred.await()
                    if (stream == null) {
                        captionsDeferred.cancel()
                        continue
                    }
                    val captions = captionsDeferred.await()
                    val qualities = stream.resolutions
                        .split(",")
                        .mapNotNull { it.trim().toIntOrNull() }
                        .distinct()
                        .sortedDescending()
                    return@runCatching PlayerLoadState.Ready(
                        subjectId = variant.id,
                        mpdUrl = stream.url,
                        signCookie = stream.signCookie,
                        format = stream.format,
                        captions = captions,
                        qualities = qualities,
                    )
                }
                PlayerLoadState.Error("No playable stream found.")
            }.onSuccess { _state.value = it }
                .onFailure { _state.value = PlayerLoadState.Error(it.message ?: "Playback failed.") }
        }
    }
}
