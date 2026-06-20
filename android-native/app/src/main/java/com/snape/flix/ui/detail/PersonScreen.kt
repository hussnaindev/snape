package com.snape.flix.ui.detail

import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material.icons.rounded.Error
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.snape.flix.R
import com.snape.flix.data.TmdbPersonCredit
import com.snape.flix.data.TmdbRepository
import com.snape.flix.ui.components.PullToRefresh
import com.snape.flix.ui.theme.ChesnaGrotesk
import kotlinx.coroutines.delay

private val Gold = Color(0xFFD4AF6E)
private val noFontPad = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))
private val CardSurface = Color(0x0DFFFFFF)
private val CardRing = Color(0x40FFFFFF)
private val CardShape = RoundedCornerShape(16.dp)
private val ChipBg = Color(0x99000000)
private val ChipBorder = Color(0x66FFFFFF)
private val TitleScrim = Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000))
private const val TRAILER_ORIGIN = "https://hussnaindev.github.io"

private fun heroHeightDp(screenHeightDp: Int): Dp =
    (0.30f * screenHeightDp).dp + 64.dp

private fun Modifier.verticalShift(dy: Dp): Modifier = layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    val d = dy.roundToPx()
    val h = (placeable.height + d).coerceAtLeast(0)
    layout(placeable.width, h) { placeable.place(0, d) }
}

@Composable
fun PersonScreen(
    personId: Int,
    onBack: () -> Unit,
    onOpenMovie: (TmdbPersonCredit) -> Unit,
    vm: PersonViewModel = viewModel(),
) {
    LaunchedEffect(personId) { vm.start(personId) }
    val state by vm.state.collectAsStateWithLifecycle()
    val s = state

    val scrollState = rememberScrollState()

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        when {
            s.loading && s.person == null -> PersonSkeleton(onBack = onBack)
            s.error != null -> PersonError(s.error, onBack)
            s.person != null -> PullToRefresh(
                isRefreshing = s.refreshing,
                onRefresh = vm::refresh,
                modifier = Modifier.fillMaxSize(),
            ) {
                PersonContent(s, scrollState, onBack, onOpenMovie)
            }
        }
    }

    LaunchedEffect(scrollState.value, s.canLoadMore) {
        val max = scrollState.maxValue
        if (max > 0 && scrollState.value >= max - 400 && s.canLoadMore) {
            vm.loadMore()
        }
    }
}

@Composable
private fun PersonContent(
    s: PersonUiState,
    scrollState: androidx.compose.foundation.ScrollState,
    onBack: () -> Unit,
    onOpenMovie: (TmdbPersonCredit) -> Unit,
) {
    val person = s.person ?: return
    val cfg = LocalConfiguration.current

    Column(Modifier.fillMaxSize().verticalScroll(scrollState)) {
        // ── Hero backdrop ──
        if (s.backdropUrl != null) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(heroHeightDp(cfg.screenHeightDp).coerceAtLeast(200.dp))
                    .background(Color.Black),
            ) {
                AsyncImage(
                    model = s.backdropUrl,
                    contentDescription = person.name,
                    contentScale = ContentScale.Crop,
                    alignment = Alignment.TopCenter,
                    modifier = Modifier.fillMaxSize(),
                )

                if (s.trailerKey != null) {
                    val webRef = remember { mutableStateOf<WebView?>(null) }
                    var trailerVisible by remember { mutableStateOf(false) }
                    var trailerMuted by remember { mutableStateOf(true) }

                    LaunchedEffect(s.trailerKey) {
                        trailerVisible = false
                        delay(8000)
                        trailerVisible = true
                    }
                    val trailerAlpha by animateFloatAsState(
                        targetValue = if (trailerVisible) 1f else 0f,
                        animationSpec = tween(durationMillis = 1000),
                        label = "trailer",
                    )
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
                                .padding(end = 16.dp, bottom = 12.dp),
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

        // ── Info block ──
        Column(
            Modifier
                .fillMaxWidth()
                .then(
                    if (s.backdropUrl != null) Modifier.verticalShift(-36.dp)
                    else Modifier.padding(top = 24.dp)
                )
                .padding(horizontal = 16.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(
                    Modifier
                        .width(96.dp)
                        .aspectRatio(2f / 3f)
                        .clip(RoundedCornerShape(4.dp))
                        .background(CardSurface),
                ) {
                    val photo = TmdbRepository.img(person.profile_path, "w342")
                    if (photo != null) {
                        AsyncImage(
                            model = photo,
                            contentDescription = person.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Icon(
                                painter = painterResource(R.drawable.snape_logo),
                                contentDescription = null,
                                tint = Color(0x59FFFFFF),
                                modifier = Modifier.size(40.dp),
                            )
                        }
                    }
                }

                Column(Modifier.weight(1f).align(Alignment.Bottom)) {
                    Text(
                        text = person.name.uppercase(),
                        color = Color(0xE6FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        lineHeight = 24.sp,
                        letterSpacing = 3.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = noFontPad,
                    )

                    if (person.known_for_department.isNotBlank()) {
                        Text(
                            text = person.known_for_department.uppercase(),
                            color = Gold,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 2.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = noFontPad,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 2.dp),
                    ) {
                        if (person.birthday != null) {
                            Text(
                                text = formatDate(person.birthday),
                                color = Color(0x99FFFFFF),
                                fontSize = 10.sp,
                                style = noFontPad,
                            )
                        }
                        if (person.birthday != null && person.place_of_birth != null) {
                            Text(
                                "·",
                                color = Color(0x33FFFFFF),
                                fontSize = 10.sp,
                                modifier = Modifier.padding(horizontal = 4.dp),
                                style = noFontPad,
                            )
                        }
                        if (person.place_of_birth != null) {
                            Text(
                                text = person.place_of_birth,
                                color = Color(0x99FFFFFF),
                                fontSize = 10.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                style = noFontPad,
                            )
                        }
                    }
                }
            }

            if (person.biography.isNotBlank()) {
                Spacer(Modifier.height(20.dp))
                ExpandableText(person.biography)
            }
        }

        // ── Known For ──
        if (s.knownFor.isNotEmpty()) {
            Spacer(Modifier.height(40.dp))
            SectionDivider("Known For")
            Spacer(Modifier.height(16.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                s.knownFor.forEach { credit ->
                    PersonCreditCard(
                        credit = credit,
                        onClick = { onOpenMovie(credit) },
                        modifier = Modifier.width(130.dp),
                    )
                }
            }
        }

        // ── Filmography ──
        if (s.visibleFilmography.isNotEmpty()) {
            Spacer(Modifier.height(40.dp))
            SectionDivider("Filmography")
            Spacer(Modifier.height(16.dp))

            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                s.visibleFilmography.chunked(2).forEach { row ->
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        row.forEach { credit ->
                            Box(Modifier.weight(1f)) {
                                PersonCreditCard(
                                    credit = credit,
                                    onClick = { onOpenMovie(credit) },
                                )
                            }
                        }
                        if (row.size == 1) {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

            if (s.canLoadMore) {
                Spacer(Modifier.height(16.dp))
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun PersonCreditCard(
    credit: TmdbPersonCredit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(CardShape)
            .background(CardSurface)
            .border(1.dp, CardRing, CardShape)
            .clickable(onClick = onClick)
            .aspectRatio(2f / 3f),
    ) {
        val poster = TmdbRepository.img(credit.poster_path, "w342")
        if (poster != null) {
            AsyncImage(
                model = poster,
                contentDescription = credit.displayTitle,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(
                Modifier.fillMaxSize().background(CardSurface),
                contentAlignment = Alignment.Center,
            ) {
                Text(credit.displayTitle, color = Color(0x33FFFFFF), fontSize = 11.sp)
            }
        }

        Box(
            Modifier
                .align(Alignment.TopStart)
                .padding(5.dp)
                .clip(RoundedCornerShape(50))
                .background(ChipBg)
                .border(0.5.dp, ChipBorder, RoundedCornerShape(50))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        ) {
            Text(
                "FILM",
                color = Color.White,
                fontSize = 8.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.3.sp,
                style = noFontPad,
            )
        }

        if (credit.vote_average > 0) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(5.dp)
                    .clip(RoundedCornerShape(50))
                    .background(ChipBg)
                    .border(0.5.dp, ChipBorder, RoundedCornerShape(50))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            ) {
                Text(
                    "★ ${"%.1f".format(credit.vote_average)}",
                    color = Color.White,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.3.sp,
                    style = noFontPad,
                )
            }
        }

        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(TitleScrim)
                .padding(horizontal = 6.dp, vertical = 5.dp),
        ) {
            Text(
                text = credit.displayTitle.uppercase(),
                color = Color(0xE6FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontSize = 9.sp,
                fontWeight = FontWeight.Light,
                letterSpacing = 1.2.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                style = noFontPad,
                modifier = Modifier.fillMaxWidth(),
            )
        }
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
            style = noFontPad,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            if (expanded) "See less" else "See more",
            color = Color(0x80FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 12.sp,
            style = noFontPad,
            modifier = Modifier.clickable { expanded = !expanded },
        )
    }
}

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

// ── Hero components ─────────────────────────────────────────────────────────────

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

private fun trailerHtml(key: String): String = """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <style>
     html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
     .wrap{position:fixed;inset:0;overflow:hidden;background:#000}
     #player{position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%) scale(1.6);
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
private fun PersonError(message: String, onBack: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Rounded.Error, contentDescription = null, tint = Color(0xCCFFFFFF), modifier = Modifier.size(40.dp))
            Text(message, color = Color(0xCCFFFFFF), fontSize = 13.sp, style = noFontPad)
            Text(
                "GO BACK",
                color = Color.White,
                fontSize = 12.sp,
                letterSpacing = 2.sp,
                style = noFontPad,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Color(0x14FFFFFF))
                    .clickable(onClick = onBack)
                    .padding(horizontal = 20.dp, vertical = 10.dp),
            )
        }
    }
}

@Composable
private fun PersonSkeleton(onBack: () -> Unit) {
    val cfg = LocalConfiguration.current
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "pulse",
    )

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(heroHeightDp(cfg.screenHeightDp).coerceAtLeast(200.dp))
                    .background(Color(0x0DFFFFFF)),
            ) {
                HeroGradient()
                BackButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
            }

            Column(Modifier.fillMaxWidth().verticalShift(-36.dp).padding(horizontal = 16.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Skel(Modifier.width(96.dp).aspectRatio(2f / 3f), pulse, RoundedCornerShape(4.dp))
                    Column(Modifier.weight(1f)) {
                        Spacer(Modifier.height(48.dp))
                        Skel(Modifier.width(180.dp).height(20.dp), pulse)
                        Spacer(Modifier.height(8.dp))
                        Skel(Modifier.width(80.dp).height(10.dp), pulse)
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Skel(Modifier.width(80.dp).height(10.dp), pulse)
                            Skel(Modifier.width(4.dp).height(10.dp), pulse)
                            Skel(Modifier.width(60.dp).height(10.dp), pulse)
                        }
                    }
                }
                Spacer(Modifier.height(20.dp))
                Skel(Modifier.fillMaxWidth().height(12.dp), pulse)
                Spacer(Modifier.height(8.dp))
                Skel(Modifier.fillMaxWidth(0.9f).height(12.dp), pulse)
                Spacer(Modifier.height(8.dp))
                Skel(Modifier.fillMaxWidth(0.7f).height(12.dp), pulse)
            }

            Spacer(Modifier.height(40.dp))
            DividerSkel(pulse)
            Spacer(Modifier.height(16.dp))
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                repeat(5) { Skel(Modifier.width(130.dp).aspectRatio(2f / 3f), pulse, CardShape) }
            }

            Spacer(Modifier.height(40.dp))
            DividerSkel(pulse)
            Spacer(Modifier.height(16.dp))
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(4) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Skel(Modifier.weight(1f).aspectRatio(2f / 3f), pulse, CardShape)
                        Skel(Modifier.weight(1f).aspectRatio(2f / 3f), pulse, CardShape)
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}

@Composable
private fun DividerSkel(pulse: Float) {
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

private fun formatDate(iso: String): String {
    return try {
        val parts = iso.split("-")
        if (parts.size == 3) {
            val year = parts[0]
            val month = when (parts[1]) {
                "01" -> "January"; "02" -> "February"; "03" -> "March"
                "04" -> "April"; "05" -> "May"; "06" -> "June"
                "07" -> "July"; "08" -> "August"; "09" -> "September"
                "10" -> "October"; "11" -> "November"; "12" -> "December"
                else -> return iso
            }
            val day = parts[2].trimStart('0')
            "$month $day, $year"
        } else iso
    } catch (_: Exception) { iso }
}
