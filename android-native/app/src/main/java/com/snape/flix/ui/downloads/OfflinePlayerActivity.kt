package com.snape.flix.ui.downloads

import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.annotation.OptIn
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.snape.flix.data.Caption
import com.snape.flix.data.Downloads
import com.snape.flix.ui.player.PlayerLoadState
import com.snape.flix.ui.player.StreamPlayerChrome

/**
 * Plays a completed offline download from the Media3 download cache — works for
 * progressive, DASH and HLS alike, since the segments were cached at download
 * time and are read back here with no network. Uses the same [StreamPlayerChrome]
 * the in-app stream player uses, so the offline experience (scrubber, controls,
 * gestures, quality menu) matches online playback exactly. Locked to landscape.
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
        // Auto-fullscreen: hide system bars (status bar) so the player fills the screen.
        window.let { w ->
            WindowInsetsControllerCompat(w, w.decorView).apply {
                hide(WindowInsetsCompat.Type.systemBars())
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        }

        val id = intent.getStringExtra(EXTRA_ID)
        if (id == null) {
            finish()
            return
        }
        val mediaItem = Downloads.mediaItem(id)
        if (mediaItem == null) {
            finish()
            return
        }
        val subtitle = Downloads.offlineSubtitle(id)

        setContent { OfflinePlayer(mediaItem, subtitle, onExit = ::finish) }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun OfflinePlayer(
    mediaItem: MediaItem,
    subtitle: Downloads.OfflineSubtitle?,
    onExit: () -> Unit,
) {
    val context = LocalContext.current
    val exo = remember(mediaItem) {
        // Wrap the cache (HTTP) factory in DefaultDataSource so the sideloaded
        // subtitle — a local file:// URI — is read off disk while the video segments
        // still come from the download cache. The HTTP factory alone can't open file
        // URIs, so without this the subtitle track silently fails to load.
        val dataSource = DefaultDataSource.Factory(context, Downloads.playbackFactory(context))
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSource))
            .build()
            .apply {
                setMediaItem(mediaItem)
                // Subtitles off until the user picks them from the menu (matches online).
                trackSelectionParameters = trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
                prepare()
                playWhenReady = true
            }
    }
    DisposableEffect(exo) { onDispose { exo.release() } }

    // Pause when the activity goes to the background so playback position is
    // preserved; the StreamPlayerChrome's keep-screen-on flag keeps the display
    // awake while actively playing.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_PAUSE) exo.pause()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // The chrome reads `captions`/`qualities` to drive its menus. Offline content is
    // downloaded at a single quality (quality menu shows "Auto" only). If a subtitle
    // was saved, expose it as a single caption so the subtitles button appears and its
    // language matches the sideloaded track for selection.
    val ready = remember(subtitle) {
        PlayerLoadState.Ready(
            subjectId = "",
            mpdUrl = "",
            signCookie = "",
            format = "",
            captions = subtitle?.let {
                listOf(Caption(id = it.lan, lan = it.lan, lanName = it.lanName, url = ""))
            } ?: emptyList(),
            qualities = emptyList(),
        )
    }

    StreamPlayerChrome(
        exo = exo,
        ready = ready,
        variants = emptyList(),
        selectedId = "",
        onSelectVariant = {},
        fullscreen = true,
        onToggleFullscreen = onExit,
        modifier = Modifier.fillMaxSize().background(Color.Black),
    )
}
