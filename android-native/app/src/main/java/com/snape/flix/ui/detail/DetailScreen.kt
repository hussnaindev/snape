package com.snape.flix.ui.detail

import android.app.Activity
import android.content.pm.ActivityInfo
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import com.snape.flix.data.TmdbCastMember
import com.snape.flix.data.TmdbEpisode
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.data.WatchProviderKey
import com.snape.flix.ui.player.AudioVariant
import com.snape.flix.ui.player.PlayerLoadState
import com.snape.flix.ui.player.PlayerViewModel
import com.snape.flix.ui.player.StreamPlayerChrome
import com.snape.flix.ui.player.audioPreferenceRank
import com.snape.flix.ui.player.rememberStreamExoPlayer
import com.snape.flix.ui.theme.ChesnaGrotesk
import kotlinx.coroutines.delay
import java.time.LocalDate

private val noFontPad = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))

// Shared layout constants so the skeleton, the loaded page and the player all use
// identical dimensions — that's what keeps the layout from shifting when TMDB
// data arrives or the inline player opens.
private val PosterW = 96.dp
private val LogoH = 56.dp
// How far the info block overlaps up into the hero (web `-mt-36`, trimmed so more
// of the backdrop/trailer stays visible).
private val MetaOverlap = 72.dp
// Mute button sits just above the info block's top edge.
private val MuteBottomInset = MetaOverlap + 12.dp

private fun heroHeightDp(screenHeightDp: Int, active: Boolean): Dp =
    ((if (active) 0.45f else 0.30f) * screenHeightDp).dp + 64.dp

/**
 * Negative/positive top "margin" that actually reclaims (or adds) layout height —
 * unlike `Modifier.offset`, which only translates drawing and would leave dead
 * space at the bottom (or clip content) as the shift changes. This keeps the
 * trailing blank space identical whether or not the inline player is open.
 */
private fun Modifier.verticalShift(dy: Dp): Modifier = layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    val d = dy.roundToPx()
    val h = (placeable.height + d).coerceAtLeast(0)
    layout(placeable.width, h) { placeable.place(0, d) }
}

@Composable
fun DetailScreen(
    group: com.snape.flix.data.SubjectGroup,
    onOpenRecommendation: (TmdbSearchHit) -> Unit,
    onBack: () -> Unit,
    vm: DetailViewModel = viewModel(),
) {
    LaunchedEffect(group) { vm.start(group) }
    val state by vm.state.collectAsStateWithLifecycle()
    val s = state
    // Show the full skeleton (laid out identically to the final page) until TMDB
    // enrichment finishes, so the page never reflows when the data lands.
    if (s == null || s.enriching) {
        DetailSkeleton(isSeries = group.primary.isSeries, onBack = onBack)
        return
    }

    val activity = LocalContext.current as? Activity
    val cfg = LocalConfiguration.current

    // Playback state. The Watch button (movies) and episode taps (series) start the
    // in-hero player; the player's fullscreen toggle expands it to a full-screen
    // landscape overlay — mirroring the web detail page exactly.
    var playerActive by remember { mutableStateOf(false) }
    var fullscreen by remember { mutableStateOf(false) }
    var currentSe by remember { mutableIntStateOf(0) }
    var currentEp by remember { mutableIntStateOf(0) }
    var requestedId by remember { mutableStateOf<String?>(null) }

    val ordered = remember(s.group) {
        s.group.variants
            .map { AudioVariant(it.subjectId, it.variantLabel) }
            .sortedBy { audioPreferenceRank(it.label) }
    }

    val playerVm: PlayerViewModel = viewModel()
    LaunchedEffect(playerActive, currentSe, currentEp, requestedId) {
        if (playerActive) {
            val candidates = requestedId
                ?.let { id -> ordered.filter { it.id == id } + ordered.filter { it.id != id } }
                ?: ordered
            playerVm.load(candidates, currentSe, currentEp)
        }
    }
    val pState by playerVm.state.collectAsStateWithLifecycle()
    val ready = pState as? PlayerLoadState.Ready
    // Single ExoPlayer call-site so the inline ↔ fullscreen toggle keeps one
    // instance (no double audio); both placements just receive this value.
    val exo = if (playerActive && ready != null) rememberStreamExoPlayer(ready) else null

    // Drive activity orientation + system bars from the fullscreen flag.
    LaunchedEffect(fullscreen) {
        activity?.requestedOrientation = if (fullscreen) {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
        activity?.window?.let { w ->
            WindowInsetsControllerCompat(w, w.decorView).apply {
                if (fullscreen) {
                    hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
                    systemBarsBehavior =
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                } else {
                    show(androidx.core.view.WindowInsetsCompat.Type.systemBars())
                }
            }
        }
    }

    BackHandler(enabled = fullscreen) { fullscreen = false }
    BackHandler(enabled = playerActive && !fullscreen) { playerActive = false }

    // Tie playback to the activity lifecycle: when this screen is no longer in the
    // foreground (e.g. opening a "More Like This" title on top, backgrounding the
    // app, or screen-off) tear the inline player down. That releases the ExoPlayer
    // and restores the backdrop, so nothing keeps playing — or leaking — behind
    // the next screen.
    val lifecycleOwner = LocalLifecycleOwner.current
    // Latest player, read at event time (the observer is created once).
    val currentExo by rememberUpdatedState(exo)
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                // Silence immediately — recomposition is deferred while stopped, so
                // don't rely on the state flip alone. Release follows when the
                // player leaves composition (on return/destroy).
                currentExo?.pause()
                fullscreen = false
                playerActive = false
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    fun play(se: Int, ep: Int) {
        currentSe = se
        currentEp = ep
        requestedId = null
        playerActive = true
    }

    val heroH by animateDpAsState(heroHeightDp(cfg.screenHeightDp, playerActive), label = "heroH")
    val metaMargin by animateDpAsState(if (playerActive) 16.dp else -MetaOverlap, label = "metaMargin")

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState(), enabled = !fullscreen),
        ) {
            // ── HERO / inline player ──────────────────────────────────────────
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(heroH.coerceAtLeast(200.dp))
                    .background(Color.Black),
            ) {
                if (playerActive && !fullscreen) {
                    when {
                        ready != null && exo != null -> StreamPlayerChrome(
                            exo = exo,
                            ready = ready,
                            variants = ordered,
                            selectedId = ready.subjectId,
                            onSelectVariant = { requestedId = it },
                            fullscreen = false,
                            onToggleFullscreen = { fullscreen = true },
                            modifier = Modifier.fillMaxSize(),
                        )
                        pState is PlayerLoadState.Error ->
                            HeroStatus((pState as PlayerLoadState.Error).message, onBack = { playerActive = false })
                        else -> HeroStatus("Loading…", spinner = true)
                    }
                } else {
                    BackdropImage(s)
                    if (s.trailerKey != null) {
                        val webRef = remember { mutableStateOf<WebView?>(null) }
                        var trailerVisible by remember { mutableStateOf(false) }
                        var trailerMuted by remember { mutableStateOf(true) }
                        // Mount immediately; reveal after a beat so the player has a frame
                        // up — matches the web's fade-in of the backdrop trailer.
                        LaunchedEffect(s.trailerKey) {
                            trailerVisible = false
                            delay(700)
                            trailerVisible = true
                        }
                        val trailerAlpha by animateFloatAsState(if (trailerVisible) 1f else 0f, label = "trailer")
                        TrailerWebView(
                            trailerKey = s.trailerKey,
                            onReady = { webRef.value = it },
                            modifier = Modifier.fillMaxSize().alpha(trailerAlpha),
                        )
                        HeroGradient()
                        BackButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
                        if (trailerVisible) {
                            MuteButton(
                                muted = trailerMuted,
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(end = 16.dp, bottom = MuteBottomInset),
                            ) {
                                trailerMuted = !trailerMuted
                                webRef.value?.evaluateJavascript(
                                    if (trailerMuted) "mute()" else "unMute()",
                                    null,
                                )
                            }
                        }
                    } else {
                        HeroGradient()
                        BackButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
                    }
                }
            }

            // ── everything below the hero — overlaps it, reclaiming the space ──
            Column(Modifier.fillMaxWidth().verticalShift(metaMargin)) {
                MetaCard(s, onWatch = { play(0, 0) })

                Spacer(Modifier.height(24.dp))

                if (s.isSeries) {
                    EpisodesCarousel(s, vm, onPlay = { se, ep -> play(se, ep) })
                }

                StarringRail(s.cast)

                if (s.recommendations.isNotEmpty()) {
                    MoreLikeThis(s.recommendations, onOpen = onOpenRecommendation)
                }

                Spacer(Modifier.height(40.dp))
            }
        }

        // ── fullscreen player overlay (same exo instance as inline) ───────────
        if (playerActive && fullscreen && ready != null && exo != null) {
            StreamPlayerChrome(
                exo = exo,
                ready = ready,
                variants = ordered,
                selectedId = ready.subjectId,
                onSelectVariant = { requestedId = it },
                fullscreen = true,
                onToggleFullscreen = { fullscreen = false },
                modifier = Modifier.fillMaxSize().zIndex(10f),
            )
        }
    }
}

// ── hero ──────────────────────────────────────────────────────────────────────

@Composable
private fun BackdropImage(s: DetailUiState) {
    val url = s.backdropUrl ?: s.posterUrl
    if (url != null) {
        AsyncImage(
            model = url,
            contentDescription = s.title,
            contentScale = ContentScale.Crop,
            alignment = Alignment.TopCenter,
            modifier = Modifier.fillMaxSize(),
        )
    } else {
        Box(Modifier.fillMaxSize().background(Color(0x0DFFFFFF)))
    }
}

/** Full top-fading gradient (web: from-black via-black/50 to-transparent). */
@Composable
private fun HeroGradient() {
    Box(
        Modifier.fillMaxSize().background(
            Brush.verticalGradient(
                0f to Color.Transparent,
                0.55f to Color(0x80000000),
                1f to Color(0xFF000000),
            ),
        ),
    )
}

/**
 * Autoplaying, muted, looped YouTube trailer in the hero backdrop — same embed
 * the web detail page uses. A WebView hosts the iframe; the CSS sizes it to cover
 * the box (16:9 scale trick) and the JS bridge exposes mute()/unMute() for the
 * mute toggle. Destroyed on dispose so audio never leaks once Watch is tapped.
 */
@Composable
private fun TrailerWebView(
    trailerKey: String,
    onReady: (WebView) -> Unit,
    modifier: Modifier = Modifier,
) {
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                setBackgroundColor(android.graphics.Color.BLACK)
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                webChromeClient = WebChromeClient()
                settings.apply {
                    javaScriptEnabled = true
                    mediaPlaybackRequiresUserGesture = false
                    domStorageEnabled = true
                    loadWithOverviewMode = true
                    useWideViewPort = true
                }
                loadDataWithBaseURL(
                    TRAILER_ORIGIN,
                    trailerHtml(trailerKey),
                    "text/html",
                    "utf-8",
                    null,
                )
                onReady(this)
            }
        },
        onRelease = { it.destroy() },
    )
}

// The WebView document must present a REAL, non-youtube https origin as its
// embedder identity. YouTube's July-2025 update rejects embeds whose HTTP Referer
// is absent or spoofed as youtube.com itself — that is what produces
// "Error code: 152-4 / this video is unavailable". Using a real origin we own and
// declaring a referrer policy that actually sends it fixes verification. Must match
// the `origin` playerVar below and the base URL passed to loadDataWithBaseURL.
private const val TRAILER_ORIGIN = "https://hussnaindev.github.io"

// Uses the YouTube IFrame Player API (loaded from youtube.com) hosted from a page
// whose origin is TRAILER_ORIGIN — the proven android-youtube-player recipe plus
// the 2025 embedder-verification fix. Key points that make it play inside a WebView
// (a bare <iframe src=embed> or a constructor `videoId` renders "Video unavailable"):
//   • create the player with NO videoId, then loadVideoById() from onReady — the
//     deferred load carries the proper origin/referrer handshake.
//   • base URL, the <meta referrer> policy, and the `origin` playerVar must all be
//     the real TRAILER_ORIGIN so YouTube receives a valid embedder Referer; do NOT
//     set `host` and do NOT spoof youtube.com here (→ error 152).
//   • loop manually by replaying on the ENDED state (playlist-loop is unreliable
//     with loadVideoById).
private fun trailerHtml(key: String): String = """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <style>
     html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
     /* clip everything outside the hero box */
     .wrap{position:fixed;inset:0;overflow:hidden;background:#000}
     /* 16:9 cover, then over-scale so YouTube's own letterbox bars (cinematic
        2.39:1 trailers) AND the player chrome (title bar / logo) are cropped
        out of view instead of showing as black bars + an overlay on start. */
     #player{position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%) scale(1.35);
      width:100vw;height:56.25vw;min-width:177.78vh;min-height:100vh}
     #player iframe{width:100%;height:100%;border:0;pointer-events:none}
    </style></head><body>
    <div class="wrap"><div id="player"></div></div>
    <script src="https://www.youtube.com/iframe_api"></script>
    <script>
     var player;
     function onYouTubeIframeAPIReady(){
       player=new YT.Player('player',{
         playerVars:{autoplay:0,controls:0,disablekb:1,enablejsapi:1,
           modestbranding:1,rel:0,playsinline:1,iv_load_policy:3,fs:0,
           origin:'$TRAILER_ORIGIN'},
         events:{
           onReady:function(e){e.target.mute();e.target.loadVideoById('$key');},
           onStateChange:function(e){
             if(e.data===YT.PlayerState.ENDED){player.seekTo(0);player.playVideo();}
           }
         }
       });
     }
     function mute(){if(player&&player.mute)player.mute();}
     function unMute(){if(player&&player.unMute)player.unMute();}
    </script>
    </body></html>
""".trimIndent()

@Composable
private fun MuteButton(muted: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(Color(0x80000000))
            .border(1.dp, Color(0x66FFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (muted) Icons.Rounded.VolumeOff else Icons.Rounded.VolumeUp,
            contentDescription = if (muted) "Unmute trailer" else "Mute trailer",
            tint = Color(0xCCFFFFFF),
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
private fun BackButton(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .statusBarsPadding()
            .padding(start = 12.dp, top = 8.dp)
            .size(36.dp)
            .clip(CircleShape)
            .background(Color(0x99000000))
            .border(1.dp, Color(0x4DFFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = "Back",
            tint = Color.White,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun HeroStatus(message: String, spinner: Boolean = false, onBack: (() -> Unit)? = null) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (spinner) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
            Text(message, color = Color(0xCCFFFFFF), fontSize = 13.sp)
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
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                )
            }
        }
    }
}

// ── meta card (poster + details + actions + synopsis) ───────────────────────────

@Composable
private fun MetaCard(s: DetailUiState, onWatch: () -> Unit) {
    var downloadOpen by remember { mutableStateOf(false) }
    if (downloadOpen) {
        DownloadSheet(group = s.group, isSeries = s.isSeries, onDismiss = { downloadOpen = false })
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            // poster
            Box(
                Modifier
                    .width(96.dp)
                    .aspectRatio(2f / 3f)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0x0DFFFFFF)),
            ) {
                if (s.posterUrl != null) {
                    AsyncImage(
                        model = s.posterUrl,
                        contentDescription = s.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }

            // details column
            Column(Modifier.weight(1f)) {
                if (s.logoUrl != null) {
                    AsyncImage(
                        model = s.logoUrl,
                        contentDescription = s.title,
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.CenterStart,
                        modifier = Modifier.width(180.dp).height(56.dp),
                    )
                } else {
                    Text(
                        text = s.title.uppercase(),
                        color = Color(0xE6FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontWeight = FontWeight.Light,
                        fontSize = 20.sp,
                        lineHeight = 24.sp,
                        letterSpacing = 3.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                Spacer(Modifier.height(6.dp))

                // year · runtime/seasons · rating
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val parts = buildList {
                        if (s.year.isNotBlank()) add(s.year)
                        if (s.isSeries) s.seasonsCountLabel?.let { add(it) }
                        else s.runtimeLabel?.let { add(it) }
                    }
                    parts.forEachIndexed { i, p ->
                        if (i > 0) Dot()
                        Text(p, color = Color(0x99FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 10.sp, style = noFontPad)
                    }
                    s.rating?.takeIf { it > 0 }?.let { r ->
                        if (parts.isNotEmpty()) Dot()
                        RatingBadge(r)
                    }
                }

                Spacer(Modifier.height(8.dp))

                // status chip (series) + genre chips
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (s.isSeries) s.statusLabel?.let { StatusChip(it) }
                    s.genres.take(3).forEach { TagChip(it) }
                }

                if (s.providers.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    WatchProvidersRow(s.providers)
                }

                Spacer(Modifier.height(12.dp))

                // actions: Watch + Download + Watchlist
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    WatchButton(modifier = Modifier.weight(1f), onClick = onWatch)
                    ActionIcon(Icons.Rounded.Download, "Download") { downloadOpen = true }
                    WatchlistIcon()
                }
            }
        }

        if (s.overview.isNotBlank()) {
            Spacer(Modifier.height(20.dp))
            ExpandableText(s.overview)
        }

        if (s.isSeries) {
            s.creators?.let {
                Spacer(Modifier.height(12.dp))
                Row {
                    Text("Created by ", color = Color(0x99FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 12.sp)
                    Text(it, color = Color(0xB3FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 12.sp)
                }
            }
            s.networks?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, color = Color(0x66FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun Dot() {
    Text(
        "·",
        color = Color(0x33FFFFFF),
        fontSize = 10.sp,
        modifier = Modifier.padding(horizontal = 5.dp),
        style = noFontPad,
    )
}

@Composable
private fun RatingBadge(rating: Double) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .border(1.dp, Color(0x66FFFFFF), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            "★ ${"%.1f".format(rating)}",
            color = Color.White,
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.SemiBold,
            fontSize = 9.sp,
            style = noFontPad,
        )
    }
}

@Composable
private fun TagChip(label: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0x0DFFFFFF))
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(
            label.uppercase(),
            color = Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.Medium,
            fontSize = 9.sp,
            letterSpacing = 0.6.sp,
            maxLines = 1,
            style = noFontPad,
        )
    }
}

@Composable
private fun StatusChip(status: String) {
    val (fg, border, bg) = when (status) {
        "Returning Series" -> Triple(Color(0xFF4ADE80), Color(0x664ADE80), Color(0x1A4ADE80))
        "In Production" -> Triple(Color(0xFF60A5FA), Color(0x6660A5FA), Color(0x1A60A5FA))
        "Canceled" -> Triple(Color(0xFFF87171), Color(0x66F87171), Color(0x1AF87171))
        else -> Triple(Color(0x66FFFFFF), Color(0x33FFFFFF), Color(0x0DFFFFFF))
    }
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(status, color = fg, fontFamily = ChesnaGrotesk, fontWeight = FontWeight.Medium, fontSize = 9.sp, style = noFontPad)
    }
}

@Composable
private fun WatchProvidersRow(providers: List<WatchProviderKey>) {
    val ctx = LocalContext.current
    // Dedicated loader with the SVG decoder; the bundled brand logos are vectors.
    val svgLoader = remember {
        ImageLoader.Builder(ctx).components { add(SvgDecoder.Factory()) }.build()
    }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        providers.forEachIndexed { i, p ->
            AsyncImage(
                model = p.asset,
                imageLoader = svgLoader,
                contentDescription = p.label,
                contentScale = ContentScale.Fit,
                // Recolour the brand logo to white, like the web's invert filter.
                colorFilter = ColorFilter.tint(Color.White),
                modifier = Modifier.height(if (p.isWide) 14.dp else 22.dp),
            )
            if (i < providers.size - 1) {
                Box(
                    Modifier
                        .padding(horizontal = 12.dp)
                        .width(1.dp)
                        .height(20.dp)
                        .background(Color(0x40FFFFFF)),
                )
            }
        }
    }
}

@Composable
private fun WatchButton(modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .height(40.dp)
            .clip(RoundedCornerShape(50))
            .background(Color.White)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            "WATCH",
            color = Color.Black,
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            letterSpacing = 2.sp,
            style = noFontPad,
        )
    }
}

@Composable
private fun ActionIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, desc: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(Color(0x99000000))
            .border(1.dp, Color(0x4DFFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = desc, tint = Color.White, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun WatchlistIcon() {
    var inList by remember { mutableStateOf(false) }
    Box(
        Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(if (inList) Color.White else Color(0x99000000))
            .border(1.dp, if (inList) Color.White else Color(0x4DFFFFFF), CircleShape)
            .clickable { inList = !inList },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (inList) Icons.Rounded.Check else Icons.Rounded.Add,
            contentDescription = if (inList) "In watchlist" else "Add to watchlist",
            tint = if (inList) Color.Black else Color.White,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun ExpandableText(text: String) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(
            text = text,
            color = Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 12.sp,
            lineHeight = 18.sp,
            maxLines = if (expanded) Int.MAX_VALUE else 3,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            if (expanded) "See less" else "See more",
            color = Color(0x80FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 12.sp,
            modifier = Modifier.clickable { expanded = !expanded },
        )
    }
}

// ── section divider ─────────────────────────────────────────────────────────

@Composable
private fun SectionDivider(label: String) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.weight(1f).height(1.dp).background(Color(0x1AFFFFFF)))
        Text(
            label.uppercase(),
            color = Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            letterSpacing = 2.sp,
            style = noFontPad,
        )
        Box(Modifier.weight(1f).height(1.dp).background(Color(0x1AFFFFFF)))
    }
}

// ── starring (cast rail) ──────────────────────────────────────────────────────

@Composable
private fun StarringRail(cast: List<TmdbCastMember>) {
    val visible = cast.take(12)
    if (visible.isEmpty()) return
    SectionDivider("Starring")
    Spacer(Modifier.height(16.dp))
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        visible.forEach { member ->
            Column(Modifier.width(96.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(Color(0x0DFFFFFF))
                        .border(2.dp, Color(0x1AFFFFFF), CircleShape),
                ) {
                    val photo = TmdbRepository.img(member.profile_path, "w185")
                    if (photo != null) {
                        AsyncImage(
                            model = photo,
                            contentDescription = member.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000)))
                        .padding(horizontal = 6.dp, vertical = 5.dp),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Text(
                            member.name.uppercase(),
                            color = Color(0xE6FFFFFF),
                            fontFamily = ChesnaGrotesk,
                            fontWeight = FontWeight.Light,
                            fontSize = 10.sp,
                            letterSpacing = 1.2.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            style = noFontPad,
                        )
                        if (member.character.isNotBlank()) {
                            Text(
                                member.character,
                                color = Color(0x80FFFFFF),
                                fontFamily = ChesnaGrotesk,
                                fontSize = 9.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = TextAlign.Center,
                                style = noFontPad,
                            )
                        }
                    }
                }
            }
        }
    }
    Spacer(Modifier.height(24.dp))
}

// ── episodes carousel ─────────────────────────────────────────────────────────

private val TODAY: String = LocalDate.now().toString()

@Composable
private fun EpisodesCarousel(
    s: DetailUiState,
    vm: DetailViewModel,
    onPlay: (se: Int, ep: Int) -> Unit,
) {
    val seasons = s.seasons
    if (seasons.isEmpty()) return

    var selectedSeason by remember(seasons) { mutableIntStateOf(seasons.first().season_number) }
    LaunchedEffect(selectedSeason) { vm.loadSeason(selectedSeason) }

    Text(
        "EPISODES",
        color = Color.White,
        fontFamily = ChesnaGrotesk,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        letterSpacing = 2.sp,
        modifier = Modifier.padding(horizontal = 16.dp),
        style = noFontPad,
    )
    Spacer(Modifier.height(12.dp))

    if (seasons.size > 1) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            seasons.forEach { season ->
                val selected = season.season_number == selectedSeason
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (selected) Color.White else Color.Transparent)
                        .border(1.dp, if (selected) Color.White else Color(0x33FFFFFF), RoundedCornerShape(50))
                        .clickable { selectedSeason = season.season_number }
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                ) {
                    Text(
                        "SEASON ${season.season_number}",
                        color = if (selected) Color.Black else Color(0x99FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontWeight = FontWeight.Medium,
                        fontSize = 11.sp,
                        letterSpacing = 1.sp,
                        style = noFontPad,
                    )
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }

    val episodes = (s.episodesBySeason[selectedSeason] ?: emptyList())
        .filter { it.air_date != null && it.air_date <= TODAY }

    if (episodes.isEmpty()) {
        Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
            if (s.episodesBySeason.containsKey(selectedSeason)) {
                Text("No episodes available.", color = Color(0x66FFFFFF), fontSize = 13.sp)
            } else {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
            }
        }
    } else {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            episodes.forEach { ep ->
                EpisodeCard(ep, onClick = { onPlay(selectedSeason, ep.episode_number) })
            }
        }
    }
    Spacer(Modifier.height(24.dp))
}

@Composable
private fun EpisodeCard(ep: TmdbEpisode, onClick: () -> Unit) {
    Box(
        Modifier
            .width(180.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0x0DFFFFFF))
            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(4f / 3f)) {
            val still = TmdbRepository.img(ep.still_path, "w500")
            if (still != null) {
                AsyncImage(
                    model = still,
                    contentDescription = ep.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(Modifier.fillMaxSize().background(Color(0x0DFFFFFF)), contentAlignment = Alignment.Center) {
                    Text("No Image", color = Color(0x33FFFFFF), fontSize = 11.sp)
                }
            }

            ep.runtime?.takeIf { it > 0 }?.let { rt ->
                MiniChip("${rt}M", Modifier.align(Alignment.TopStart).padding(6.dp))
            }
            if (ep.vote_average > 0) {
                MiniChip("★ ${"%.1f".format(ep.vote_average)}", Modifier.align(Alignment.TopEnd).padding(6.dp))
            }

            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000)))
                    .padding(horizontal = 8.dp, vertical = 5.dp),
            ) {
                Text(
                    "E${ep.episode_number}: ${ep.name}",
                    color = Color(0xE6FFFFFF),
                    fontFamily = ChesnaGrotesk,
                    fontWeight = FontWeight.Light,
                    fontSize = 10.sp,
                    letterSpacing = 1.2.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                    style = noFontPad,
                )
            }
        }
    }
}

@Composable
private fun MiniChip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0x99000000))
            .border(0.5.dp, Color(0x66FFFFFF), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(text, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 8.sp, style = noFontPad)
    }
}

// ── more like this ─────────────────────────────────────────────────────────

@Composable
private fun MoreLikeThis(recs: List<TmdbSearchHit>, onOpen: (TmdbSearchHit) -> Unit) {
    SectionDivider("More Like This")
    Spacer(Modifier.height(8.dp))
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        recs.forEach { hit ->
            Box(
                Modifier
                    .width(130.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x0DFFFFFF))
                    .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(16.dp))
                    .clickable { onOpen(hit) },
            ) {
                Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f)) {
                    val poster = TmdbRepository.img(hit.poster_path, "w342")
                    if (poster != null) {
                        AsyncImage(
                            model = poster,
                            contentDescription = hit.displayTitle,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    MiniChip(if (hit.name.isNotBlank()) "SERIES" else "FILM", Modifier.align(Alignment.TopStart).padding(5.dp))
                    if (hit.vote_average > 0) {
                        MiniChip("★ ${"%.1f".format(hit.vote_average)}", Modifier.align(Alignment.TopEnd).padding(5.dp))
                    }
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .background(Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000)))
                            .padding(horizontal = 6.dp, vertical = 5.dp),
                    ) {
                        Text(
                            hit.displayTitle.uppercase(),
                            color = Color(0xE6FFFFFF),
                            fontFamily = ChesnaGrotesk,
                            fontWeight = FontWeight.Light,
                            fontSize = 9.sp,
                            letterSpacing = 1.2.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                            style = noFontPad,
                        )
                    }
                }
            }
        }
    }
}

// ── skeleton — laid out 1:1 with the loaded page so nothing reflows ─────────────

@Composable
private fun DetailSkeleton(isSeries: Boolean, onBack: () -> Unit) {
    val cfg = LocalConfiguration.current
    val pulse by rememberInfiniteTransition(label = "skeleton").animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "pulse",
    )

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            // hero
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(heroHeightDp(cfg.screenHeightDp, false).coerceAtLeast(200.dp))
                    .background(Color(0x0DFFFFFF)),
            ) {
                HeroGradient()
                BackButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
            }

            Column(Modifier.fillMaxWidth().verticalShift(-MetaOverlap)) {
                // info block
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Skel(Modifier.width(PosterW).aspectRatio(2f / 3f), pulse)
                        Column(Modifier.weight(1f)) {
                            Skel(Modifier.width(180.dp).height(LogoH), pulse)
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Skel(Modifier.width(60.dp).height(12.dp), pulse)
                                Skel(Modifier.width(44.dp).height(12.dp), pulse)
                                Skel(Modifier.width(52.dp).height(12.dp), pulse)
                            }
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                repeat(3) {
                                    Skel(Modifier.width(56.dp).height(22.dp), pulse, RoundedCornerShape(50))
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            Skel(Modifier.width(120.dp).height(22.dp), pulse)
                            Spacer(Modifier.height(12.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Skel(Modifier.weight(1f).height(40.dp), pulse, RoundedCornerShape(50))
                                Skel(Modifier.size(36.dp), pulse, CircleShape)
                                Skel(Modifier.size(36.dp), pulse, CircleShape)
                            }
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                    Skel(Modifier.fillMaxWidth().height(12.dp), pulse)
                    Spacer(Modifier.height(8.dp))
                    Skel(Modifier.fillMaxWidth(0.9f).height(12.dp), pulse)
                    Spacer(Modifier.height(8.dp))
                    Skel(Modifier.fillMaxWidth(0.6f).height(12.dp), pulse)
                }

                Spacer(Modifier.height(24.dp))

                if (isSeries) {
                    Skel(Modifier.padding(horizontal = 16.dp).width(96.dp).height(14.dp), pulse)
                    Spacer(Modifier.height(12.dp))
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        repeat(4) {
                            Skel(Modifier.width(180.dp).aspectRatio(4f / 3f), pulse, RoundedCornerShape(16.dp))
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }

                // starring
                SkelDivider(pulse)
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    repeat(6) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Skel(Modifier.size(96.dp), pulse, CircleShape)
                            Spacer(Modifier.height(6.dp))
                            Skel(Modifier.width(80.dp).height(20.dp), pulse, RoundedCornerShape(6.dp))
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))

                // more like this
                SkelDivider(pulse)
                Spacer(Modifier.height(8.dp))
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    repeat(6) {
                        Skel(Modifier.width(130.dp).aspectRatio(2f / 3f), pulse, RoundedCornerShape(16.dp))
                    }
                }

                Spacer(Modifier.height(40.dp))
            }
        }
    }
}

@Composable
private fun SkelDivider(pulse: Float) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.weight(1f).height(1.dp).background(Color(0x1AFFFFFF)))
        Skel(Modifier.width(64.dp).height(12.dp), pulse)
        Box(Modifier.weight(1f).height(1.dp).background(Color(0x1AFFFFFF)))
    }
}

@Composable
private fun Skel(modifier: Modifier, pulse: Float, shape: Shape = RoundedCornerShape(4.dp)) {
    Box(modifier.clip(shape).background(Color.White.copy(alpha = 0.12f * pulse)))
}
