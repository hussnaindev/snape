package com.snape.flix.ui.player

import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.annotation.OptIn
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ClosedCaption
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.snape.flix.data.MovieBoxSign
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.delay
import kotlin.math.max

private val ProgressRed = Color(0xFFFF0000)
private val SpinnerRed = Color(0xFFE50914)

class PlayerActivity : ComponentActivity() {

    companion object {
        const val EXTRA_SUBJECT_ID = "subjectId"
        const val EXTRA_TITLE = "title"
        const val EXTRA_SE = "se"
        const val EXTRA_EP = "ep"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        val subjectId = intent.getStringExtra(EXTRA_SUBJECT_ID).orEmpty()
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val se = intent.getIntExtra(EXTRA_SE, 0)
        val ep = intent.getIntExtra(EXTRA_EP, 0)

        setContent {
            SnapeTheme {
                val vm: PlayerViewModel = viewModel()
                LaunchedEffect(Unit) { vm.load(subjectId, se, ep) }
                val state by vm.state.collectAsStateWithLifecycle()
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    when (val s = state) {
                        is PlayerLoadState.Loading -> CenterStatus("Loading…", spinner = true)
                        is PlayerLoadState.Error -> CenterStatus(s.message, spinner = false, onBack = ::finish)
                        is PlayerLoadState.Ready -> PlayerSurface(s, title, onBack = ::finish)
                    }
                }
            }
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun PlayerSurface(ready: PlayerLoadState.Ready, title: String, onBack: () -> Unit) {
    val context = LocalContext.current

    val exo = remember {
        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(MovieBoxSign.USER_AGENT)
            .setAllowCrossProtocolRedirects(true)
            .setDefaultRequestProperties(mapOf("Cookie" to ready.signCookie))

        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
            .build()
            .apply {
                val subs = ready.captions.map { c ->
                    MediaItem.SubtitleConfiguration.Builder(Uri.parse(c.url))
                        .setMimeType(MimeTypes.APPLICATION_SUBRIP)
                        .setLanguage(c.lan.ifBlank { c.id })
                        .setLabel(c.lanName)
                        .build()
                }
                setMediaItem(
                    MediaItem.Builder()
                        .setUri(ready.mpdUrl)
                        .setMimeType(MimeTypes.APPLICATION_MPD)
                        .setSubtitleConfigurations(subs)
                        .build(),
                )
                trackSelectionParameters = trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
                prepare()
                playWhenReady = true
            }
    }

    DisposableEffect(Unit) { onDispose { exo.release() } }

    var openMenu by remember { mutableStateOf(Menu.NONE) }
    var qualityHeight by remember { mutableStateOf<Int?>(null) }
    var subtitleLang by remember { mutableStateOf<String?>(null) }

    var isPlaying by remember { mutableStateOf(exo.isPlaying) }
    var isBuffering by remember { mutableStateOf(false) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var bufferedMs by remember { mutableLongStateOf(0L) }
    var controlsVisible by remember { mutableStateOf(true) }
    var scrubFraction by remember { mutableFloatStateOf(-1f) }

    DisposableEffect(exo) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                isBuffering = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY) {
                    durationMs = max(exo.duration, 0L)
                }
            }

            override fun onEvents(player: Player, events: Player.Events) {
                if (events.containsAny(
                        Player.EVENT_TIMELINE_CHANGED,
                        Player.EVENT_PLAYBACK_STATE_CHANGED,
                        Player.EVENT_IS_PLAYING_CHANGED,
                    )
                ) {
                    durationMs = max(player.duration, 0L)
                    positionMs = max(player.currentPosition, 0L)
                    bufferedMs = max(player.bufferedPosition, 0L)
                }
            }
        }
        exo.addListener(listener)
        onDispose { exo.removeListener(listener) }
    }

    LaunchedEffect(isPlaying, isBuffering) {
        while (isPlaying || isBuffering) {
            positionMs = max(exo.currentPosition, 0L)
            bufferedMs = max(exo.bufferedPosition, 0L)
            durationMs = max(exo.duration, 0L)
            delay(250)
        }
    }

    LaunchedEffect(controlsVisible, isPlaying) {
        if (controlsVisible && isPlaying) {
            delay(3000)
            controlsVisible = false
        }
    }

    fun showControls() {
        controlsVisible = true
    }

    fun togglePlay() {
        if (exo.isPlaying) exo.pause() else exo.play()
        showControls()
    }

    fun skip(seconds: Int) {
        val target = (exo.currentPosition + seconds * 1000L).coerceIn(0L, max(exo.duration, 0L))
        exo.seekTo(target)
        showControls()
    }

    val controlsAlpha by animateFloatAsState(if (controlsVisible || !isPlaying) 1f else 0f, label = "controls")
    val displayPositionMs = if (scrubFraction >= 0f && durationMs > 0) {
        (scrubFraction * durationMs).toLong()
    } else {
        positionMs
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exo
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setBackgroundColor(android.graphics.Color.BLACK)
                    subtitleView?.apply {
                        setApplyEmbeddedStyles(false)
                        setApplyEmbeddedFontSizes(false)
                        setStyle(
                            CaptionStyleCompat(
                                android.graphics.Color.WHITE,
                                0x99000000.toInt(),
                                android.graphics.Color.TRANSPARENT,
                                CaptionStyleCompat.EDGE_TYPE_NONE,
                                android.graphics.Color.BLACK,
                                Typeface.MONOSPACE,
                            ),
                        )
                        setFractionalTextSize(0.055f)
                    }
                }
            },
        )

        // Tap surface — toggle controls (matches web single-tap behavior).
        Box(
            Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures { controlsVisible = !controlsVisible }
                },
        )

        // Center buffering spinner (web-style Netflix red ring).
        if (isBuffering) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(Color.Transparent)
                            .border(1.dp, Color(0x1AFFFFFF), CircleShape),
                    )
                    CircularProgressIndicator(
                        color = SpinnerRed,
                        strokeWidth = 4.dp,
                        modifier = Modifier.size(64.dp),
                    )
                }
            }
        }

        // Controls overlay — omitted when hidden so taps reach the video surface.
        if (controlsVisible || !isPlaying) {
            Box(
                Modifier
                    .fillMaxSize()
                    .alpha(controlsAlpha),
            ) {
            // Top gradient + back.
            Box(
                Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .background(Brush.verticalGradient(listOf(Color(0xB3000000), Color.Transparent)))
                    .padding(horizontal = 12.dp, vertical = 14.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBtn(Icons.AutoMirrored.Rounded.ArrowBack, "Back", onClick = onBack)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // Center play/pause (web-style frosted circle).
            if (controlsVisible || !isPlaying) {
                Box(
                    Modifier
                        .align(Alignment.Center)
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(Color(0x1AFFFFFF))
                        .border(1.dp, Color(0x33FFFFFF), CircleShape)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = ::togglePlay,
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    if (isPlaying) PlayerPauseIcon(size = 34.dp) else PlayerPlayIcon(size = 36.dp)
                }
            }

            // Bottom bar — gradient, scrubber, controls.
            Column(
                Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xD9000000))))
                    .padding(horizontal = 12.dp)
                    .padding(bottom = 12.dp, top = 48.dp),
            ) {
                ScrubBar(
                    progress = if (durationMs > 0) displayPositionMs.toFloat() / durationMs else 0f,
                    buffered = if (durationMs > 0) bufferedMs.toFloat() / durationMs else 0f,
                    onScrub = { fraction -> scrubFraction = fraction },
                    onScrubEnd = { fraction ->
                        if (durationMs > 0) exo.seekTo((fraction * durationMs).toLong())
                        scrubFraction = -1f
                        showControls()
                    },
                )

                Spacer(Modifier.height(4.dp))

                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CtrlBtn(onClick = ::togglePlay, label = if (isPlaying) "Pause" else "Play") {
                        if (isPlaying) PlayerPauseIcon() else PlayerPlayIcon()
                    }
                    CtrlBtn(onClick = { skip(-10) }, label = "Back 10s") { PlayerSkipBackIcon() }
                    CtrlBtn(onClick = { skip(10) }, label = "Forward 10s") { PlayerSkipForwardIcon() }

                    Text(
                        text = "${fmtTime(displayPositionMs)} / ${fmtTime(durationMs)}",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                    )

                    Spacer(Modifier.weight(1f))

                    CtrlBtn(
                        onClick = {
                            openMenu = if (openMenu == Menu.SUBTITLES) Menu.NONE else Menu.SUBTITLES
                            showControls()
                        },
                        label = "Subtitles",
                        active = subtitleLang != null,
                    ) {
                        Icon(Icons.Rounded.ClosedCaption, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                    }
                    CtrlBtn(
                        onClick = {
                            openMenu = if (openMenu == Menu.QUALITY) Menu.NONE else Menu.QUALITY
                            showControls()
                        },
                        label = "Quality",
                        active = qualityHeight != null,
                    ) {
                        Icon(Icons.Rounded.Settings, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                    }
                }
            }
        }
        }

        if (openMenu == Menu.QUALITY) {
            OptionPanel(
                title = "Quality",
                options = buildList {
                    add(OptionRow("Auto", qualityHeight == null) {
                        qualityHeight = null
                        exo.setQuality(null)
                        openMenu = Menu.NONE
                    })
                    ready.qualities.forEach { h ->
                        add(OptionRow("${h}p", qualityHeight == h) {
                            qualityHeight = h
                            exo.setQuality(h)
                            openMenu = Menu.NONE
                        })
                    }
                },
                onDismiss = { openMenu = Menu.NONE },
            )
        }

        if (openMenu == Menu.SUBTITLES) {
            OptionPanel(
                title = "Subtitles",
                options = buildList {
                    add(OptionRow("Off", subtitleLang == null) {
                        subtitleLang = null
                        exo.setSubtitle(null)
                        openMenu = Menu.NONE
                    })
                    ready.captions.forEach { c ->
                        val lang = c.lan.ifBlank { c.id }
                        add(OptionRow(c.lanName.ifBlank { c.lan }, subtitleLang == lang) {
                            subtitleLang = lang
                            exo.setSubtitle(lang)
                            openMenu = Menu.NONE
                        })
                    }
                    if (ready.captions.isEmpty()) {
                        add(OptionRow("No subtitles available", false) { openMenu = Menu.NONE })
                    }
                },
                onDismiss = { openMenu = Menu.NONE },
            )
        }
    }
}

@Composable
private fun ScrubBar(
    progress: Float,
    buffered: Float,
    onScrub: (Float) -> Unit,
    onScrubEnd: (Float) -> Unit,
) {
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(12.dp)
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val fraction = (offset.x / size.width).coerceIn(0f, 1f)
                    onScrub(fraction)
                    onScrubEnd(fraction)
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        val trackHeight = 3.dp
        Box(
            Modifier
                .fillMaxWidth()
                .height(trackHeight)
                .clip(RoundedCornerShape(50))
                .background(Color(0x33FFFFFF)),
        ) {
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .fillMaxWidth(buffered.coerceIn(0f, 1f))
                    .height(trackHeight)
                    .background(Color(0x66FFFFFF)),
            )
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .fillMaxWidth(progress.coerceIn(0f, 1f))
                    .height(trackHeight)
                    .background(ProgressRed),
            )
        }
        Box(
            Modifier
                .align(Alignment.CenterStart)
                .padding(start = maxWidth * progress.coerceIn(0f, 1f) - 6.5.dp)
                .size(13.dp)
                .clip(CircleShape)
                .background(ProgressRed),
        )
    }
}

@Composable
private fun CtrlBtn(
    onClick: () -> Unit,
    label: String,
    active: Boolean = false,
    content: @Composable () -> Unit,
) {
    Box(
        Modifier
            .clip(RoundedCornerShape(4.dp))
            .clickable(onClick = onClick)
            .padding(4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            content()
            if (active) {
                Box(
                    Modifier
                        .padding(top = 2.dp)
                        .width(12.dp)
                        .height(2.dp)
                        .background(ProgressRed),
                )
            }
        }
    }
}

private fun fmtTime(ms: Long): String {
    if (ms <= 0) return "0:00"
    val totalSec = ms / 1000
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) {
        "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    } else {
        "$m:${s.toString().padStart(2, '0')}"
    }
}

private enum class Menu { NONE, QUALITY, SUBTITLES }

private data class OptionRow(val label: String, val selected: Boolean, val onClick: () -> Unit)

@OptIn(UnstableApi::class)
private fun ExoPlayer.setQuality(height: Int?) {
    trackSelectionParameters = trackSelectionParameters.buildUpon().apply {
        if (height == null) {
            clearVideoSizeConstraints()
        } else {
            setMaxVideoSize(Int.MAX_VALUE, height)
            setMinVideoSize(0, height)
        }
    }.build()
}

@OptIn(UnstableApi::class)
private fun ExoPlayer.setSubtitle(lang: String?) {
    trackSelectionParameters = trackSelectionParameters.buildUpon().apply {
        if (lang == null) {
            setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        } else {
            setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            setPreferredTextLanguage(lang)
        }
    }.build()
}

@Composable
private fun IconBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, desc: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(38.dp)
            .clip(RoundedCornerShape(50))
            .background(Color(0x66000000))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = desc, tint = Color.White, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun OptionPanel(title: String, options: List<OptionRow>, onDismiss: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color(0x66000000)).clickable(onClick = onDismiss),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .widthIn(min = 200.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xF2101010))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                ) {}
                .padding(vertical = 8.dp),
        ) {
            Text(
                title.uppercase(),
                color = Color(0x80FFFFFF),
                fontSize = 10.sp,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            )
            options.forEach { row ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable(onClick = row.onClick)
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        Modifier.size(6.dp).clip(RoundedCornerShape(50))
                            .background(if (row.selected) Color.White else Color.Transparent),
                    )
                    Text(
                        row.label,
                        color = if (row.selected) Color.White else Color(0xB3FFFFFF),
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

@Composable
private fun CenterStatus(message: String, spinner: Boolean, onBack: (() -> Unit)? = null) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (spinner) {
                Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SpinnerRed, strokeWidth = 4.dp, modifier = Modifier.size(64.dp))
                }
            }
            Text(message, color = Color(0xCCFFFFFF), fontSize = 14.sp)
            if (onBack != null) {
                Text(
                    "GO BACK",
                    color = Color.White,
                    fontSize = 12.sp,
                    letterSpacing = 2.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(Color(0x14FFFFFF))
                        .clickable(onClick = onBack)
                        .padding(horizontal = 24.dp, vertical = 12.dp),
                )
            }
        }
    }
}
