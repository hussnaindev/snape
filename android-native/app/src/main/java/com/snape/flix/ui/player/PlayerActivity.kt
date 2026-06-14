package com.snape.flix.ui.player

import android.content.pm.ActivityInfo
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.IntOffset
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
import kotlin.math.roundToInt

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
        // Draw the video into the display cutout area so a notch/camera no longer
        // leaves a black letterbox strip on the short/long edge in landscape.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        hideSystemBars()

        val subjectId = intent.getStringExtra(EXTRA_SUBJECT_ID).orEmpty()
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
                        is PlayerLoadState.Ready -> PlayerSurface(s)
                    }
                }
            }
        }
    }

    // Re-assert immersive mode whenever the window regains focus — the system
    // re-shows the bars after dialogs, the volume panel, or a swipe-reveal.
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun PlayerSurface(ready: PlayerLoadState.Ready) {
    val context = LocalContext.current

    // --- streaming setup (unchanged) ----------------------------------------
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
                // Subtitles off by default; user opts in via the CC menu.
                trackSelectionParameters = trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
                prepare()
                playWhenReady = true
            }
    }

    DisposableEffect(Unit) { onDispose { exo.release() } }

    // --- player state mirrored into Compose ---------------------------------
    var playing by remember { mutableStateOf(exo.isPlaying) }
    var playbackState by remember { mutableIntStateOf(exo.playbackState) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var bufferedMs by remember { mutableLongStateOf(0L) }
    var scrubbing by remember { mutableStateOf(false) }
    var scrubFrac by remember { mutableFloatStateOf(0f) }

    DisposableEffect(exo) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { playing = isPlaying }
            override fun onPlaybackStateChanged(state: Int) {
                playbackState = state
                if (state == Player.STATE_READY) durationMs = exo.duration.coerceAtLeast(0L)
            }
        }
        exo.addListener(listener)
        onDispose { exo.removeListener(listener) }
    }

    // Poll position/buffer a few times a second (cheap; only the slider redraws).
    LaunchedEffect(exo) {
        while (true) {
            if (!scrubbing) {
                positionMs = exo.currentPosition.coerceAtLeast(0L)
                bufferedMs = exo.bufferedPosition.coerceAtLeast(0L)
                if (durationMs <= 0L) durationMs = exo.duration.coerceAtLeast(0L)
            }
            delay(250)
        }
    }

    // --- chrome state -------------------------------------------------------
    val activity = context as? android.app.Activity
    var controlsShown by remember { mutableStateOf(true) }
    var openMenu by remember { mutableStateOf(Menu.NONE) }
    var qualityHeight by remember { mutableStateOf<Int?>(null) } // null = auto
    var subtitleLang by remember { mutableStateOf<String?>(null) } // null = off
    var speed by remember { mutableFloatStateOf(1f) }
    var fillScreen by remember { mutableStateOf(true) }
    var portraitAllowed by remember { mutableStateOf(false) }
    var surfaceWidthPx by remember { mutableIntStateOf(1) }

    val buffering = playbackState == Player.STATE_BUFFERING
    val chromeVisible = controlsShown || !playing

    // Auto-hide the controls while playing.
    LaunchedEffect(controlsShown, playing, openMenu) {
        if (controlsShown && playing && openMenu == Menu.NONE) {
            delay(3200)
            controlsShown = false
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exo
                    useController = false // we draw our own web-style chrome
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setBackgroundColor(android.graphics.Color.BLACK)
                    subtitleView?.apply {
                        setApplyEmbeddedStyles(false)
                        setApplyEmbeddedFontSizes(false)
                        setStyle(
                            CaptionStyleCompat(
                                android.graphics.Color.WHITE,
                                0x99000000.toInt(), // 60% opacity black background
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
            update = { it.resizeMode = if (fillScreen) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT },
        )

        // Tap surface: single tap toggles the chrome (or dismisses a menu),
        // double-tap on the left/right third seeks ∓10s, center toggles play.
        Box(
            Modifier
                .fillMaxSize()
                .onSizeChanged { surfaceWidthPx = it.width.coerceAtLeast(1) }
                .pointerInput(Unit) {
                    detectTapGestures(
                        onTap = {
                            if (openMenu != Menu.NONE) openMenu = Menu.NONE
                            else controlsShown = !controlsShown
                        },
                        onDoubleTap = { offset ->
                            val third = surfaceWidthPx / 3f
                            when {
                                offset.x < third -> exo.seekBy(-10_000)
                                offset.x > third * 2 -> exo.seekBy(10_000)
                                else -> exo.togglePlay()
                            }
                            controlsShown = true
                        },
                    )
                },
        )

        // Center: loading spinner while buffering, else play/pause.
        if (buffering) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center).size(64.dp),
                color = Color(0xFFE50914),
                strokeWidth = 4.dp,
                trackColor = Color(0x1AFFFFFF),
            )
        } else if (chromeVisible) {
            CenterPlayButton(
                playing = playing,
                modifier = Modifier.align(Alignment.Center),
                onClick = { exo.togglePlay() },
            )
        }

        if (chromeVisible) {
            // Bottom: scrubber + control row over a gradient.
            Column(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(0f to Color.Transparent, 1f to Color(0xD9000000)))
                    .padding(horizontal = 12.dp)
                    .padding(top = 40.dp, bottom = 12.dp),
            ) {
                Scrubber(
                    positionMs = positionMs,
                    durationMs = durationMs,
                    bufferedMs = bufferedMs,
                    scrubbing = scrubbing,
                    scrubFrac = scrubFrac,
                    onScrubStart = { f -> scrubbing = true; scrubFrac = f },
                    onScrub = { f -> scrubFrac = f },
                    onScrubEnd = { f ->
                        if (durationMs > 0) exo.seekTo((f * durationMs).toLong())
                        positionMs = (f * durationMs).toLong()
                        scrubbing = false
                    },
                    onSeek = { f -> if (durationMs > 0) exo.seekTo((f * durationMs).toLong()) },
                )

                Spacer(Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Ctrl(if (playing) PlayerIcons.Pause else PlayerIcons.Play, "Play/Pause") { exo.togglePlay() }
                    Spacer(Modifier.width(14.dp))
                    Ctrl(PlayerIcons.Replay10, "Back 10s", size = 24.dp) { exo.seekBy(-10_000) }
                    Spacer(Modifier.width(14.dp))
                    Ctrl(PlayerIcons.Forward10, "Forward 10s", size = 24.dp) { exo.seekBy(10_000) }
                    Spacer(Modifier.width(14.dp))

                    val displayMs = if (scrubbing) (scrubFrac * durationMs).toLong() else positionMs
                    Text(
                        text = "${fmt(displayMs)}  /  ${fmt(durationMs)}",
                        color = Color.White,
                        fontSize = 13.sp,
                    )

                    Spacer(Modifier.weight(1f))

                    if (ready.captions.isNotEmpty()) {
                        Ctrl(
                            PlayerIcons.Captions,
                            "Subtitles",
                            active = subtitleLang != null,
                        ) { openMenu = if (openMenu == Menu.SUBTITLES) Menu.NONE else Menu.SUBTITLES }
                        Spacer(Modifier.width(14.dp))
                    }
                    Ctrl(PlayerIcons.Settings, "Settings") {
                        openMenu = if (openMenu == Menu.SETTINGS || openMenu == Menu.QUALITY || openMenu == Menu.SPEED) Menu.NONE else Menu.SETTINGS
                    }
                    Spacer(Modifier.width(14.dp))
                    Ctrl(PlayerIcons.FillScreen, "Fill screen", active = fillScreen) { fillScreen = !fillScreen }
                    Spacer(Modifier.width(14.dp))
                    Ctrl(
                        if (portraitAllowed) PlayerIcons.FullscreenEnter else PlayerIcons.FullscreenExit,
                        "Rotate",
                    ) {
                        portraitAllowed = !portraitAllowed
                        activity?.requestedOrientation = if (portraitAllowed) {
                            ActivityInfo.SCREEN_ORIENTATION_SENSOR
                        } else {
                            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                        }
                    }
                }
            }
        }

        // --- menus (bottom-right popup, web-style) --------------------------
        if (openMenu != Menu.NONE) {
            MenuPopup(modifier = Modifier.align(Alignment.BottomEnd)) {
                when (openMenu) {
                    Menu.SETTINGS -> {
                        RowItem("Quality", qualityHeight?.let { "${it}p" } ?: "Auto") { openMenu = Menu.QUALITY }
                        RowItem("Speed", "${speed}x") { openMenu = Menu.SPEED }
                    }
                    Menu.QUALITY -> {
                        OptItem("Auto", qualityHeight == null) {
                            qualityHeight = null; exo.setQuality(null); openMenu = Menu.NONE
                        }
                        ready.qualities.forEach { h ->
                            OptItem("${h}p", qualityHeight == h) {
                                qualityHeight = h; exo.setQuality(h); openMenu = Menu.NONE
                            }
                        }
                    }
                    Menu.SPEED -> SPEEDS.forEach { sp ->
                        OptItem("${sp}x", sp == speed) {
                            speed = sp; exo.setPlaybackSpeed(sp); openMenu = Menu.NONE
                        }
                    }
                    Menu.SUBTITLES -> {
                        OptItem("Off", subtitleLang == null) {
                            subtitleLang = null; exo.setSubtitle(null); openMenu = Menu.NONE
                        }
                        ready.captions.forEach { c ->
                            val lang = c.lan.ifBlank { c.id }
                            OptItem(c.lanName.ifBlank { c.lan }, subtitleLang == lang) {
                                subtitleLang = lang; exo.setSubtitle(lang); openMenu = Menu.NONE
                            }
                        }
                    }
                    Menu.NONE -> Unit
                }
            }
        }
    }
}

private enum class Menu { NONE, SETTINGS, QUALITY, SPEED, SUBTITLES }

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)

private fun ExoPlayer.togglePlay() {
    if (isPlaying) pause() else play()
}

private fun ExoPlayer.seekBy(deltaMs: Long) {
    val target = (currentPosition + deltaMs).coerceIn(0L, if (duration > 0) duration else Long.MAX_VALUE)
    seekTo(target)
}

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

private fun fmt(ms: Long): String {
    if (ms <= 0) return "0:00"
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/** YouTube-style scrubber: white/20 track, white/40 buffered, red played + knob. */
@Composable
private fun Scrubber(
    positionMs: Long,
    durationMs: Long,
    bufferedMs: Long,
    scrubbing: Boolean,
    scrubFrac: Float,
    onScrubStart: (Float) -> Unit,
    onScrub: (Float) -> Unit,
    onScrubEnd: (Float) -> Unit,
    onSeek: (Float) -> Unit,
) {
    val red = Color(0xFFFF0000)
    var widthPx by remember { mutableIntStateOf(1) }
    val knobPx = with(LocalDensity.current) { 13.dp.toPx() }.toInt()

    val playedFrac = (if (scrubbing) scrubFrac else if (durationMs > 0) positionMs.toFloat() / durationMs else 0f)
        .coerceIn(0f, 1f)
    val bufferedFrac = (if (durationMs > 0) bufferedMs.toFloat() / durationMs else 0f).coerceIn(0f, 1f)

    Box(
        Modifier
            .fillMaxWidth()
            .height(20.dp)
            .onSizeChanged { widthPx = it.width.coerceAtLeast(1) }
            .pointerInput(Unit) {
                detectTapGestures { o -> onSeek((o.x / widthPx).coerceIn(0f, 1f)) }
            }
            .pointerInput(Unit) {
                // dragFrac tracks the live position so onDragEnd commits the
                // latest fraction (the captured `scrubFrac` param would be stale,
                // since this gesture block is not restarted on recomposition).
                var dragFrac = 0f
                detectHorizontalDragGestures(
                    onDragStart = { o -> dragFrac = (o.x / widthPx).coerceIn(0f, 1f); onScrubStart(dragFrac) },
                    onHorizontalDrag = { change, _ ->
                        dragFrac = (change.position.x / widthPx).coerceIn(0f, 1f)
                        onScrub(dragFrac)
                        change.consume()
                    },
                    onDragEnd = { onScrubEnd(dragFrac) },
                    onDragCancel = { onScrubEnd(dragFrac) },
                )
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        // track
        Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape).background(Color(0x33FFFFFF))) {
            Box(Modifier.fillMaxWidth(bufferedFrac).height(3.dp).background(Color(0x66FFFFFF)))
            Box(Modifier.fillMaxWidth(playedFrac).height(3.dp).background(red))
        }
        // knob
        Box(
            Modifier
                .offset { IntOffset((widthPx * playedFrac).roundToInt() - knobPx / 2, 0) }
                .size(13.dp)
                .clip(CircleShape)
                .background(red),
        )
    }
}

@Composable
private fun CenterPlayButton(playing: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .size(64.dp)
            .clip(CircleShape)
            .background(Color(0x1AFFFFFF))
            .border(1.dp, Color(0x33FFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (playing) PlayerIcons.Pause else PlayerIcons.Play,
            contentDescription = if (playing) "Pause" else "Play",
            tint = Color.White,
            modifier = Modifier.size(30.dp),
        )
    }
}

/** A bottom-bar control button with the web's red active underline. */
@Composable
private fun Ctrl(
    icon: ImageVector,
    desc: String,
    active: Boolean = false,
    size: androidx.compose.ui.unit.Dp = 24.dp,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, desc, tint = Color.White, modifier = Modifier.size(size))
        if (active) {
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 1.dp)
                    .size(width = 12.dp, height = 2.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFFF0000)),
            )
        }
    }
}

@Composable
private fun MenuPopup(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .padding(end = 16.dp, bottom = 76.dp)
            // Fixed compact width — without a max, the fillMaxWidth rows would
            // stretch the popup across the whole player.
            .width(220.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xF2000000))
            .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(12.dp))
            // Consume taps so they don't fall through to the toggle surface.
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) {}
            .heightIn(max = 300.dp)
            .verticalScroll(rememberScrollState())
            .padding(vertical = 6.dp),
    ) {
        content()
    }
}

@Composable
private fun RowItem(label: String, value: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = Color.White, fontSize = 14.sp)
        Spacer(Modifier.weight(1f))
        Text("$value  ›", color = Color(0x80FFFFFF), fontSize = 12.sp)
    }
}

@Composable
private fun OptItem(label: String, active: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier.size(6.dp).clip(CircleShape)
                .background(if (active) Color(0xFFE50914) else Color.Transparent),
        )
        Text(label, color = if (active) Color.White else Color(0xB3FFFFFF), fontSize = 14.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun CenterStatus(message: String, spinner: Boolean, onBack: (() -> Unit)? = null) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (spinner) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
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
