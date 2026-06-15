package com.snape.flix.ui.player

import android.content.res.Configuration
import android.net.Uri
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.List
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.text.CueGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.snape.flix.data.MovieBoxSign
import com.snape.flix.ui.theme.MonoFont
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/** One selectable audio/language variant of the same title. */
data class AudioVariant(val id: String, val label: String)

/** One episode shown in the in-player episodes carousel (series only). */
data class PlayerEpisode(
    val se: Int,
    val ep: Int,
    val label: String,
    val stillUrl: String?,
)

/** Default playback preference: Original → English → Hindi → everything else. */
fun audioPreferenceRank(label: String): Int = when {
    label.equals("Original", true) -> 0
    label.equals("English", true) -> 1
    label.equals("Hindi", true) -> 2
    else -> 3
}

/**
 * Build (and own) an ExoPlayer for a resolved stream. Keyed on the stream URL so
 * switching episode/variant rebuilds it, while an inline ↔ fullscreen toggle (which
 * keeps the same [ready]) preserves the instance and uninterrupted playback.
 */
@OptIn(UnstableApi::class)
@Composable
fun rememberStreamExoPlayer(ready: PlayerLoadState.Ready, startPositionMs: Long = 0L): ExoPlayer {
    val context = LocalContext.current
    val exo = remember(ready.mpdUrl) {
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
                        .setMimeType(
                            when (ready.format.uppercase()) {
                                "HLS" -> MimeTypes.APPLICATION_M3U8
                                "MP4" -> MimeTypes.VIDEO_MP4
                                else -> MimeTypes.APPLICATION_MPD
                            },
                        )
                        .setSubtitleConfigurations(subs)
                        .build(),
                )
                trackSelectionParameters = trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
                // Resume where the user left off (Continue Watching / re-entry).
                if (startPositionMs > 0) seekTo(startPositionMs)
                prepare()
                playWhenReady = true
            }
    }
    DisposableEffect(exo) { onDispose { exo.release() } }
    return exo
}

/**
 * The web-style player chrome (scrubber, controls, menus, captions overlay). The
 * same composable backs the inline detail-hero player and its fullscreen overlay;
 * [fullscreen] only changes the fullscreen toggle icon and the control density.
 */
@OptIn(UnstableApi::class)
@Composable
fun StreamPlayerChrome(
    exo: ExoPlayer,
    ready: PlayerLoadState.Ready,
    variants: List<AudioVariant>,
    selectedId: String,
    onSelectVariant: (String) -> Unit,
    fullscreen: Boolean,
    onToggleFullscreen: () -> Unit,
    modifier: Modifier = Modifier,
    episodes: List<PlayerEpisode> = emptyList(),
    currentSe: Int = 0,
    currentEp: Int = 0,
    onSelectEpisode: (se: Int, ep: Int) -> Unit = { _, _ -> },
    onProgress: (positionMs: Long, durationMs: Long) -> Unit = { _, _ -> },
) {
    var cueText by remember { mutableStateOf("") }

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
            override fun onCues(cueGroup: CueGroup) {
                cueText = cueGroup.cues.joinToString("\n") { it.text?.toString().orEmpty() }.trim()
            }
        }
        exo.addListener(listener)
        onDispose { exo.removeListener(listener) }
    }

    LaunchedEffect(exo) {
        var sinceReport = 0
        while (true) {
            if (!scrubbing) {
                positionMs = exo.currentPosition.coerceAtLeast(0L)
                bufferedMs = exo.bufferedPosition.coerceAtLeast(0L)
                if (durationMs <= 0L) durationMs = exo.duration.coerceAtLeast(0L)
            }
            // Persist progress about every 5s while playing (and not scrubbing) so
            // Continue Watching stays current without thrashing storage.
            if (!scrubbing && playing && positionMs > 0) {
                if (++sinceReport >= 20) {
                    sinceReport = 0
                    onProgress(positionMs, durationMs)
                }
            }
            delay(250)
        }
    }

    // Capture the final position when the player leaves composition (back out of
    // playback, switch episode, screen-off) so the resume point is exact.
    val latestPos by rememberUpdatedState(positionMs)
    val latestDur by rememberUpdatedState(durationMs)
    DisposableEffect(Unit) {
        onDispose { if (latestPos > 0) onProgress(latestPos, latestDur) }
    }

    var controlsShown by remember { mutableStateOf(true) }
    var openMenu by remember { mutableStateOf(Menu.NONE) }
    var episodesShown by remember { mutableStateOf(false) }
    var qualityHeight by remember { mutableStateOf<Int?>(null) }
    var subtitleLang by remember { mutableStateOf<String?>(null) }
    var speed by remember { mutableFloatStateOf(1f) }
    var fillScreen by remember { mutableStateOf(true) }
    var muted by remember { mutableStateOf(false) }
    var surfaceWidthPx by remember { mutableIntStateOf(1) }

    // Inline (portrait) has far less width: drop the ∓10s skip buttons and tighten
    // icon size + spacing so nothing clips. Fullscreen (landscape) shows them all.
    val compact = !fullscreen ||
        LocalConfiguration.current.orientation == Configuration.ORIENTATION_PORTRAIT
    val ctrlSize = if (compact) 22.dp else 24.dp
    val gap = if (compact) 10.dp else 14.dp

    val buffering = playbackState == Player.STATE_BUFFERING
    val chromeVisible = controlsShown || !playing

    LaunchedEffect(controlsShown, playing, openMenu) {
        if (controlsShown && playing && openMenu == Menu.NONE) {
            delay(3200)
            controlsShown = false
        }
    }

    Box(modifier.background(Color.Black)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exo
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setBackgroundColor(android.graphics.Color.BLACK)
                    subtitleView?.visibility = android.view.View.GONE
                }
            },
            update = {
                it.player = exo
                it.resizeMode = if (fillScreen) {
                    AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                } else {
                    AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            },
            onRelease = { it.player = null },
        )

        if (cueText.isNotEmpty()) {
            Box(
                Modifier
                    .fillMaxSize()
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 12.dp),
                contentAlignment = Alignment.BottomCenter,
            ) {
                Text(
                    text = cueText,
                    color = Color.White,
                    fontFamily = MonoFont,
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color(0x8C000000))
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }
        }

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

        if (buffering) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center).size(56.dp),
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
                    Ctrl(if (playing) PlayerIcons.Pause else PlayerIcons.Play, "Play/Pause", size = ctrlSize) { exo.togglePlay() }
                    if (!compact) {
                        Spacer(Modifier.width(gap))
                        Ctrl(PlayerIcons.Replay10, "Back 10s", size = ctrlSize) { exo.seekBy(-10_000) }
                        Spacer(Modifier.width(gap))
                        Ctrl(PlayerIcons.Forward10, "Forward 10s", size = ctrlSize) { exo.seekBy(10_000) }
                    }
                    Spacer(Modifier.width(gap))
                    Ctrl(
                        if (muted) PlayerIcons.VolumeOff else PlayerIcons.VolumeOn,
                        if (muted) "Unmute" else "Mute",
                        active = muted,
                        size = ctrlSize,
                    ) {
                        muted = !muted
                        exo.volume = if (muted) 0f else 1f
                    }
                    Spacer(Modifier.width(gap))

                    val displayMs = if (scrubbing) (scrubFrac * durationMs).toLong() else positionMs
                    Text(
                        text = "${fmt(displayMs)}  /  ${fmt(durationMs)}",
                        color = Color.White,
                        fontSize = if (compact) 12.sp else 13.sp,
                    )

                    Spacer(Modifier.weight(1f))

                    if (episodes.isNotEmpty()) {
                        Ctrl(
                            Icons.AutoMirrored.Rounded.List,
                            "Episodes",
                            active = episodesShown,
                            size = ctrlSize,
                        ) {
                            episodesShown = !episodesShown
                            openMenu = Menu.NONE
                        }
                        Spacer(Modifier.width(gap))
                    }
                    if (ready.captions.isNotEmpty()) {
                        Ctrl(
                            PlayerIcons.Captions,
                            "Subtitles",
                            active = subtitleLang != null,
                            size = ctrlSize,
                        ) { openMenu = if (openMenu == Menu.SUBTITLES) Menu.NONE else Menu.SUBTITLES }
                        Spacer(Modifier.width(gap))
                    }
                    Ctrl(PlayerIcons.Settings, "Settings", size = ctrlSize) {
                        openMenu = if (openMenu == Menu.SETTINGS || openMenu == Menu.QUALITY || openMenu == Menu.SPEED || openMenu == Menu.AUDIO) Menu.NONE else Menu.SETTINGS
                    }
                    Spacer(Modifier.width(gap))
                    Ctrl(PlayerIcons.FillScreen, "Fill screen", active = fillScreen, size = ctrlSize) { fillScreen = !fillScreen }
                    Spacer(Modifier.width(gap))
                    Ctrl(
                        if (fullscreen) PlayerIcons.FullscreenExit else PlayerIcons.FullscreenEnter,
                        "Fullscreen",
                        size = ctrlSize,
                        onClick = onToggleFullscreen,
                    )
                }
            }
        }

        if (episodesShown && episodes.isNotEmpty()) {
            EpisodesOverlay(
                episodes = episodes,
                currentSe = currentSe,
                currentEp = currentEp,
                modifier = Modifier.align(Alignment.BottomCenter),
                onSelect = { se, ep ->
                    episodesShown = false
                    if (se != currentSe || ep != currentEp) onSelectEpisode(se, ep)
                },
            )
        }

        if (openMenu != Menu.NONE) {
            MenuPopup(modifier = Modifier.align(Alignment.BottomEnd)) {
                when (openMenu) {
                    Menu.SETTINGS -> {
                        RowItem("Quality", qualityHeight?.let { "${it}p" } ?: "Auto") { openMenu = Menu.QUALITY }
                        RowItem("Speed", "${speed}x") { openMenu = Menu.SPEED }
                        if (variants.size > 1) {
                            val current = variants.firstOrNull { it.id == selectedId }?.label ?: "Original"
                            RowItem("Audio", current) { openMenu = Menu.AUDIO }
                        }
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
                    Menu.AUDIO -> variants.forEach { v ->
                        OptItem(v.label, v.id == selectedId) {
                            if (v.id != selectedId) onSelectVariant(v.id)
                            openMenu = Menu.NONE
                        }
                    }
                    Menu.NONE -> Unit
                }
            }
        }
    }
}

private enum class Menu { NONE, SETTINGS, QUALITY, SPEED, SUBTITLES, AUDIO }

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
        Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape).background(Color(0x33FFFFFF))) {
            Box(Modifier.fillMaxWidth(bufferedFrac).height(3.dp).background(Color(0x66FFFFFF)))
            Box(Modifier.fillMaxWidth(playedFrac).height(3.dp).background(red))
        }
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

/**
 * The in-player episodes carousel (web player's "Episodes" button). A horizontally
 * scrolling strip of episode stills anchored above the controls bar; tapping one
 * switches playback to that episode. The currently-playing episode is ringed.
 */
@Composable
private fun EpisodesOverlay(
    episodes: List<PlayerEpisode>,
    currentSe: Int,
    currentEp: Int,
    modifier: Modifier = Modifier,
    onSelect: (se: Int, ep: Int) -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(0f to Color.Transparent, 1f to Color(0xF2000000)))
            .navigationBarsPadding()
            .padding(start = 12.dp, end = 12.dp, top = 28.dp, bottom = 84.dp),
    ) {
        Text(
            "EPISODES",
            color = Color.White,
            fontSize = 11.sp,
            letterSpacing = 2.sp,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
        )
        androidx.compose.foundation.lazy.LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            androidx.compose.foundation.lazy.items(episodes) { e ->
                val current = e.se == currentSe && e.ep == currentEp
                Column(
                    Modifier
                        .width(150.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { onSelect(e.se, e.ep) },
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0x1AFFFFFF))
                            .border(
                                width = if (current) 2.dp else 1.dp,
                                color = if (current) Color(0xFFFF0000) else Color(0x33FFFFFF),
                                shape = RoundedCornerShape(10.dp),
                            ),
                    ) {
                        if (e.stillUrl != null) {
                            coil.compose.AsyncImage(
                                model = e.stillUrl,
                                contentDescription = e.label,
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)),
                            )
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        e.label,
                        color = if (current) Color.White else Color(0xB3FFFFFF),
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 2.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun MenuPopup(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .padding(end = 16.dp, bottom = 76.dp)
            .width(220.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xF2000000))
            .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(12.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) {}
            .heightIn(max = 200.dp)
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
