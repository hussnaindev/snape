package com.snape.flix.ui.downloads

import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import java.io.File

/**
 * Plays a completed offline download from local storage — a bare full-screen
 * Media3 [PlayerView] over the local file (no streaming, no cookies). Locked to
 * landscape like the in-app stream player's fullscreen mode.
 */
class OfflinePlayerActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_PATH = "path"
        fun start(context: Context, path: String) {
            context.startActivity(
                Intent(context, OfflinePlayerActivity::class.java).putExtra(EXTRA_PATH, path),
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

        val path = intent.getStringExtra(EXTRA_PATH)
        if (path.isNullOrBlank() || !File(path).exists()) {
            finish()
            return
        }

        setContent {
            OfflinePlayer(path)
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun OfflinePlayer(path: String) {
    AndroidView(
        modifier = Modifier.fillMaxSize().background(Color.Black),
        factory = { ctx ->
            val player = ExoPlayer.Builder(ctx).build().apply {
                setMediaItem(MediaItem.fromUri(Uri.fromFile(File(path))))
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
