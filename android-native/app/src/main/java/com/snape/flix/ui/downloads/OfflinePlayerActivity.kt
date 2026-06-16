package com.snape.flix.ui.downloads

import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import com.snape.flix.data.Downloads

/**
 * Plays a completed offline download from the Media3 download cache — works for
 * progressive, DASH and HLS alike, since the segments were cached at download
 * time and are read back here with no network. Locked to landscape like the
 * in-app stream player's fullscreen mode.
 */
class OfflinePlayerActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_ID = "id"
        fun start(context: Context, id: String) {
            context.startActivity(
                Intent(context, OfflinePlayerActivity::class.java).putExtra(EXTRA_ID, id),
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

        val id = intent.getStringExtra(EXTRA_ID)
        val mediaItem = id?.let { Downloads.mediaItem(it) }
        if (mediaItem == null) {
            finish()
            return
        }

        setContent { OfflinePlayer(mediaItem) }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun OfflinePlayer(mediaItem: MediaItem) {
    AndroidView(
        modifier = Modifier.fillMaxSize().background(Color.Black),
        factory = { ctx ->
            val player = ExoPlayer.Builder(ctx)
                .setMediaSourceFactory(DefaultMediaSourceFactory(Downloads.playbackFactory(ctx)))
                .build()
                .apply {
                    setMediaItem(mediaItem)
                    prepare()
                    playWhenReady = true
                }
            PlayerView(ctx).apply {
                this.player = player
                setBackgroundColor(android.graphics.Color.BLACK)
            }
        },
        onRelease = { it.player?.release() },
    )
}
