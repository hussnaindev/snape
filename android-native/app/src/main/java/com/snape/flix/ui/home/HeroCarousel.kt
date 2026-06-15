package com.snape.flix.ui.home

import android.view.LayoutInflater
import androidx.annotation.OptIn
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.snape.flix.R
import kotlin.math.abs
import kotlinx.coroutines.delay

/**
 * The home hero — a pixel replica of the web `HeroSection` (the static Apple-TV
 * Originals carousel). Same swipeable slides, gradient scrims, badge/logo/meta
 * and the scaled-dot pill indicator. After a 2s dwell each slide autoplays its
 * HLS trailer (muted), crossfading over the still — exactly like the web.
 *
 * Slides aren't catalogue data; they're brand content, so they're hard-coded to
 * match the web verbatim. The Watch / More Info buttons resolve the title to a
 * MovieBox subject via [onOpenTitle].
 */

private data class HeroSlide(
    val bgAsset: String,
    val logoAsset: String?,
    val title: String,
    val badge: String?,
    val metadata: String,
    val rating: String,
    val trailerUrl: String,
)

private const val A = "file:///android_asset/apple-tv/"

private val SLIDES = listOf(
    HeroSlide(
        "${A}slide-4-desktop.webp", "${A}slide-4-logo.webp", "Stick",
        null, "TV Show", "TV-MA",
        "https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1815366977&isExternal=true&brandId=tvs.sbd.4000&id=1131292652&l=en-US&aec=UHD",
    ),
    HeroSlide(
        "${A}slide-5-desktop.webp", "${A}slide-5-logo.webp", "Your Friends & Neighbors",
        "New Episode Every Friday", "TV Show", "TV-MA",
        "https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1875429673&isExternal=true&brandId=tvs.sbd.4000&id=1283390014&l=en-US&aec=UHD",
    ),
    HeroSlide(
        "${A}slide-8-desktop.webp", "${A}slide-8-logo.webp", "Monarch: Legacy of Monsters",
        null, "TV Show", "TV-14",
        "https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1867658901&isExternal=true&brandId=tvs.sbd.4000&id=1283929122&l=en-US&aec=UHD",
    ),
    HeroSlide(
        "${A}slide-9-desktop.webp", "${A}slide-9-logo.webp", "Widow's Bay",
        "New Episode Every Wednesday", "TV Show", "TV-MA",
        "https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1888549019&isExternal=true&brandId=tvs.sbd.4000&id=1327736478&l=en-US&aec=UHD",
    ),
    HeroSlide(
        "${A}slide-10-desktop.webp", "${A}slide-10-logo.webp", "Shrinking",
        null, "TV Show", "TV-MA",
        "https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1855667906&isExternal=true&brandId=tvs.sbd.4000&id=1235227606&l=en-US&aec=UHD",
    ),
    HeroSlide(
        "${A}slide-11-desktop.webp", "${A}slide-11-logo.webp", "For All Mankind",
        "New Episode Every Friday", "TV Show", "TV-MA",
        "https://play-edge.itunes.apple.com/WebObjects/MZPlayLocal.woa/hls/subscription/playlist.m3u8?cc=US&svcId=tvs.vds.4105&a=1873096122&isExternal=true&brandId=tvs.sbd.4000&id=1269359171&l=en-US&aec=UHD",
    ),
)

private val PageBg = Color(0xFF070B08)

// The home scroll jank turned out to be the LazyColumn re-composing sections on
// the fling (now a Column + verticalScroll), not the hero video — so the trailer
// is back on. The PlayerView is inflated as a TextureView (see hero_trailer_view
// .xml) rather than the default SurfaceView, so it composites like a normal view
// and never hole-punches the window or forces a relayout while scrolling.
private const val HERO_TRAILER_ENABLED = true

@OptIn(UnstableApi::class)
@Composable
fun HeroCarousel(
    onOpenTitle: (title: String, isSeries: Boolean) -> Unit,
    playbackEnabled: Boolean,
    modifier: Modifier = Modifier,
    scrolling: Boolean = false,
) {
    val context = LocalContext.current
    val screenH = LocalConfiguration.current.screenHeightDp.dp
    val heroH = (screenH * 0.55f).coerceAtLeast(320.dp)

    // Randomize the slide order once per app launch so the hero doesn't always
    // open on the same title.
    val slides = remember { SLIDES.shuffled() }
    val pagerState = rememberPagerState(pageCount = { slides.size })

    // One shared muted player; fed the current slide's trailer after a 2s dwell.
    // The Apple trailer manifests advertise up to UHD; decoding/buffering 4K for a
    // small muted hero needlessly loads the codec + GPU and competes with the list
    // scroll, so cap the selected video to 720p and trim the buffer (we only ever
    // play a few seconds before the user scrolls). Both cut steady-state jank.
    val player = remember {
        if (!HERO_TRAILER_ENABLED) return@remember null
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(2_000, 10_000, 1_000, 2_000)
            .build()
        ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .build().apply {
                volume = 0f
                repeatMode = Player.REPEAT_MODE_OFF
                trackSelectionParameters = trackSelectionParameters
                    .buildUpon()
                    .setMaxVideoSize(1280, 720)
                    .build()
            }
    }
    var videoReady by remember { mutableStateOf(false) }

    DisposableEffect(player) {
        val p = player ?: return@DisposableEffect onDispose { }
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) videoReady = true
            }
        }
        p.addListener(listener)
        onDispose {
            p.removeListener(listener)
            p.release()
        }
    }

    // Reset + re-arm the trailer whenever the slide settles or playback toggles.
    LaunchedEffect(pagerState.currentPage, playbackEnabled) {
        val p = player ?: return@LaunchedEffect
        videoReady = false
        p.stop()
        p.clearMediaItems()
        if (!playbackEnabled) return@LaunchedEffect
        delay(2000)
        val slide = slides[pagerState.currentPage]
        p.setMediaItem(
            MediaItem.Builder()
                .setUri(slide.trailerUrl)
                .setMimeType(MimeTypes.APPLICATION_M3U8)
                .build(),
        )
        p.prepare()
        p.playWhenReady = true
    }

    Box(modifier.fillMaxWidth().height(heroH).background(PageBg)) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            val slide = slides[page]
            Box(Modifier.fillMaxSize().clipToBounds()) {
                AsyncImage(
                    model = slide.bgAsset,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    alignment = Alignment.TopCenter,
                    modifier = Modifier.fillMaxSize(),
                )

                // Trailer video on the active page, crossfaded over the still.
                if (HERO_TRAILER_ENABLED && player != null && page == pagerState.currentPage) {
                    val videoAlpha by animateFloatAsState(
                        targetValue = if (videoReady && playbackEnabled) 1f else 0f,
                        label = "heroVideoAlpha",
                    )
                    // Drop the heavy video surface out of the tree while the list
                    // is actively scrolling (the muted player keeps its position),
                    // so scrolling never drags a SurfaceView along — keeps it smooth.
                    if (videoAlpha > 0f && !scrolling) {
                        AndroidView(
                            factory = { ctx ->
                                // Inflated (not new PlayerView(ctx)) so it's a
                                // TextureView — surface_type is an inflation-time
                                // attribute with no programmatic setter.
                                (LayoutInflater.from(ctx)
                                    .inflate(R.layout.hero_trailer_view, null) as PlayerView)
                                    .apply {
                                        setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                                        this.player = player
                                    }
                            },
                            // RESIZE_MODE_ZOOM already fills the box; the extra
                            // over-scale crops residual letterbox bars / chrome
                            // out of view (mirrors the detail trailer's scale 1.35).
                            modifier = Modifier.fillMaxSize().graphicsLayer {
                                scaleX = 1.35f
                                scaleY = 1.35f
                                alpha = videoAlpha
                            },
                        )
                    }
                }

                // Bottom scrim — fades the still into the section below (#070b08).
                Box(
                    Modifier.fillMaxSize().background(
                        Brush.verticalGradient(
                            0.0f to Color.Transparent,
                            0.38f to Color.Transparent,
                            0.65f to PageBg.copy(alpha = 0.55f),
                            0.90f to PageBg,
                        ),
                    ),
                )

                // Content — bottom-left.
                Column(
                    Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(start = 20.dp, end = 20.dp, bottom = 44.dp),
                    horizontalAlignment = Alignment.Start,
                ) {
                    slide.badge?.let { badge ->
                        Text(
                            text = badge,
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .padding(bottom = 8.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0x26FFFFFF))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }

                    if (slide.logoAsset != null) {
                        AsyncImage(
                            model = slide.logoAsset,
                            contentDescription = slide.title,
                            contentScale = ContentScale.Fit,
                            alignment = Alignment.CenterStart,
                            modifier = Modifier
                                .heightIn(max = 42.dp)
                                .widthIn(max = 220.dp)
                                .padding(bottom = 8.dp),
                        )
                    } else {
                        Text(
                            text = slide.title,
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(bottom = 10.dp),
                    ) {
                        Text(slide.metadata, color = Color(0xB3FFFFFF), fontSize = 10.sp)
                        Text(
                            text = slide.rating.replace('_', '-').uppercase(),
                            color = Color(0xB3FFFFFF),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier
                                .clip(RoundedCornerShape(2.dp))
                                .border(1.dp, Color(0x66FFFFFF), RoundedCornerShape(2.dp))
                                .padding(horizontal = 4.dp, vertical = 0.dp),
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PillButton(
                            label = "WATCH",
                            primary = true,
                            onClick = { onOpenTitle(slide.title, true) },
                        )
                        PillButton(
                            label = "MORE INFO",
                            primary = false,
                            onClick = { onOpenTitle(slide.title, true) },
                        )
                    }
                }
            }
        }

        // Dotted indicator — the pill with scaled dots, fixed above the track.
        Row(
            Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 12.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0xB8070B08))
                .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(14.dp))
                .padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for (i in slides.indices) {
                val dist = abs(i - pagerState.currentPage)
                val target = when {
                    i == pagerState.currentPage -> 0.45f
                    dist == 1 -> 0.35f
                    dist == 2 -> 0.25f
                    else -> 0.20f
                }
                val s by animateFloatAsState(targetValue = target, label = "dot$i")
                Box(Modifier.size(14.dp), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier
                            .size(14.dp)
                            .scale(s)
                            .clip(CircleShape)
                            .background(
                                if (i == pagerState.currentPage) Color(0xE6FFFFFF)
                                else Color(0x4DFFFFFF),
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun PillButton(label: String, primary: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        Modifier
            .height(36.dp)
            .widthIn(min = 112.dp)
            .clip(shape)
            .then(
                if (primary) Modifier.background(Color.White)
                else Modifier.background(Color(0x1AFFFFFF)).border(1.dp, Color(0x33FFFFFF), shape),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (primary) {
                // ▶ play glyph
                Text("▶", color = Color.Black, fontSize = 9.sp)
                Spacer(Modifier.width(6.dp))
            }
            Text(
                text = label,
                color = if (primary) Color.Black else Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
