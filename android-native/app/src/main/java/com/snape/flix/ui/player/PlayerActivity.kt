package com.snape.flix.ui.player

import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ClosedCaption
import androidx.compose.material.icons.rounded.HighQuality
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
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
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.snape.flix.data.MovieBoxSign
import com.snape.flix.ui.theme.SnapeTheme

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
                // Subtitles off by default; user opts in via the CC menu.
                trackSelectionParameters = trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
                prepare()
                playWhenReady = true
            }
    }

    DisposableEffect(Unit) { onDispose { exo.release() } }

    var openMenu by remember { mutableStateOf(Menu.NONE) }
    var qualityHeight by remember { mutableStateOf<Int?>(null) } // null = auto
    var subtitleLang by remember { mutableStateOf<String?>(null) } // null = off

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exo
                    useController = true
                    // Fill the screen by default (preserve aspect, crop overscan).
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setShowSubtitleButton(false)
                    setShowNextButton(false)
                    setShowPreviousButton(false)
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
        )

        // Top control bar — back, title, quality, subtitles.
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp)
                .align(Alignment.TopCenter),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconBtn(Icons.AutoMirrored.Rounded.ArrowBack, "Back", onClick = onBack)
            Spacer(Modifier.width(12.dp))
            Text(
                text = title,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            IconBtn(Icons.Rounded.HighQuality, "Quality") {
                openMenu = if (openMenu == Menu.QUALITY) Menu.NONE else Menu.QUALITY
            }
            Spacer(Modifier.width(8.dp))
            IconBtn(Icons.Rounded.ClosedCaption, "Subtitles") {
                openMenu = if (openMenu == Menu.SUBTITLES) Menu.NONE else Menu.SUBTITLES
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
    // Scrim that closes the menu, plus the panel itself.
    Box(
        Modifier.fillMaxSize().background(Color(0x66000000)).clickable(onClick = onDismiss),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .widthIn(min = 200.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xF2101010))
                // Consume clicks so taps on the panel don't fall through to the scrim.
                .clickable(
                    interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
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
