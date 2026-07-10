package com.snape.flix.ui.detail

import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.snape.flix.data.Caption
import com.snape.flix.data.DownloadItem
import com.snape.flix.data.DownloadStatus
import com.snape.flix.data.Downloads
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.theme.ChesnaGrotesk
import com.snape.flix.ui.tv.focusHighlight

/**
 * The web's Download button → options modal, ported to a bottom sheet: Quality /
 * Audio / Subtitles chips + a Download CTA. Confirming hands the resolved (Cookie-
 * signed) stream to the in-app [Downloads] engine, which streams it to local
 * storage with pause/resume — the native equivalent of the web's offline save.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DownloadSheet(
    group: SubjectGroup,
    isSeries: Boolean,
    onDismiss: () -> Unit,
    posterUrl: String? = null,
    logoUrl: String? = null,
    year: String = "",
    rating: Double? = null,
    initialSe: Int? = null,
    initialEp: Int? = null,
    // When opened from a long-press on a specific episode card, lock to that
    // episode — show only its download options, not the season/episode pickers.
    lockSelection: Boolean = false,
    vm: DownloadViewModel = viewModel(),
) {
    val context = LocalContext.current

    var audioIdx by remember { mutableIntStateOf(0) }
    var quality by remember { mutableStateOf("") }
    var subIdx by remember { mutableIntStateOf(-1) }
    var selectedSeason by remember { mutableIntStateOf(initialSe ?: 1) }
    var selectedEpisode by remember { mutableIntStateOf(initialEp ?: 1) }
    var seasonItems by remember { mutableStateOf<List<SeasonItem>>(emptyList()) }
    var seasonsLoading by remember { mutableStateOf(true) }

    // Fetch season info for series
    LaunchedEffect(isSeries, audioIdx) {
        if (!isSeries) {
            seasonsLoading = false
            return@LaunchedEffect
        }
        val sid = group.variants.getOrNull(audioIdx)?.subjectId ?: group.primary.subjectId
        seasonsLoading = true
        val items = runCatching { MovieBoxRepository.seasonInfo(sid) }
            .getOrDefault(emptyList())
        seasonItems = items
        seasonsLoading = false
        if (items.isNotEmpty() && initialSe == null) {
            selectedSeason = items.first().se
            selectedEpisode = 1
        }
    }

    LaunchedEffect(audioIdx, selectedSeason, selectedEpisode) {
        val variant = group.variants.getOrNull(audioIdx) ?: return@LaunchedEffect
        vm.load(variant.subjectId, if (isSeries) selectedSeason else 0, if (isSeries) selectedEpisode else 0)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Reset quality default when stream arrives.
    LaunchedEffect(state) {
        val ready = state as? DownloadState.Ready ?: return@LaunchedEffect
        quality = ready.qualities.firstOrNull { it == "720p" }
            ?: ready.qualities.firstOrNull { it == "480p" }
            ?: ready.qualities.firstOrNull()
            ?: "Auto"
        subIdx = -1
    }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val heading = if (isSeries) "${group.primary.title} · S$selectedSeason E$selectedEpisode" else group.primary.title

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF0F0F10),
        contentColor = Color.White,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            // header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Download", color = Color.White, fontFamily = ChesnaGrotesk, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text(heading, color = Color(0x66FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 12.sp, maxLines = 1)
                }
                Box(
                    Modifier
                        .size(36.dp)
                        .focusHighlight(RoundedCornerShape(12.dp))
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x0DFFFFFF))
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Close, "Close", tint = Color(0x99FFFFFF), modifier = Modifier.size(18.dp))
                }
            }

            Spacer(Modifier.height(20.dp))

            when (val st = state) {
                is DownloadState.Loading -> Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
                }
                is DownloadState.Unavailable -> Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    Text("This title isn't available to download right now.", color = Color(0x80FFFFFF), fontSize = 13.sp)
                }
                is DownloadState.Ready -> {
                    // Language / Audio first — it determines which subject the season,
                    // episode and quality options are resolved from.
                    if (group.variants.size > 1) {
                        Field("Language / Audio") {
                            ChipRow(group.variants.map { it.variantLabel }, group.variants[audioIdx].variantLabel) { label ->
                                audioIdx = group.variants.indexOfFirst { it.variantLabel == label }.coerceAtLeast(0)
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                    }
                    if (isSeries && !lockSelection && seasonItems.isNotEmpty()) {
                        Field("Season") {
                            ChipRow(seasonItems.map { it.se.toString() }, selectedSeason.toString()) { v ->
                                val newSeason = v.toIntOrNull() ?: return@ChipRow
                                selectedSeason = newSeason
                                selectedEpisode = 1
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        val maxEp = seasonItems.firstOrNull { it.se == selectedSeason }?.maxEp ?: 0
                        Field("Episode") {
                            ChipRow((1..maxEp).map { it.toString() }, selectedEpisode.toString()) { v ->
                                selectedEpisode = v.toIntOrNull() ?: return@ChipRow
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                    }
                    if (st.qualities.isNotEmpty()) {
                        Field("Quality") {
                            ChipRow(st.qualities, quality) { quality = it }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Field("Subtitles") {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Chip("None", subIdx == -1) { subIdx = -1 }
                            st.subtitles.forEachIndexed { i, sub ->
                                Chip(sub.lanName.ifBlank { sub.lan }, subIdx == i) { subIdx = i }
                            }
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    val allDownloads by Downloads.items.collectAsStateWithLifecycle()
                    val variant = group.variants.getOrNull(audioIdx) ?: group.primary
                    val match = allDownloads.firstOrNull { d ->
                        d.subjectId == variant.subjectId &&
                        d.se == selectedSeason &&
                        d.ep == selectedEpisode &&
                        d.quality == quality
                    }
                    val isCompleted = match?.status == DownloadStatus.COMPLETED
                    val isActive = match != null && !isCompleted

                    when {
                        match == null -> {
                            // Not downloaded — show normal Download button.
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .focusHighlight(RoundedCornerShape(50), scale = 1.02f)
                                    .clip(RoundedCornerShape(50))
                                    .background(Color.White)
                                    .clickable {
                                        val sub = if (subIdx >= 0) st.subtitles.getOrNull(subIdx) else null
                                        enqueue(st, group, audioIdx, isSeries, selectedSeason, selectedEpisode, quality, posterUrl, logoUrl, year, rating, sub)
                                        Toast.makeText(context, "Download started · $heading ($quality)", Toast.LENGTH_SHORT).show()
                                        onDismiss()
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.Download, null, tint = Color.Black, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("DOWNLOAD", color = Color.Black, fontFamily = ChesnaGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 2.sp)
                                }
                            }
                        }
                        isCompleted -> {
                            // This exact variant + quality is saved — black pill with a
                            // green label. Tapping jumps to the downloads page.
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .focusHighlight(RoundedCornerShape(50), scale = 1.02f)
                                    .clip(RoundedCornerShape(50))
                                    .background(Color.Black)
                                    .border(1.dp, Color(0x4D34D399), RoundedCornerShape(50))
                                    .clickable {
                                        com.snape.flix.ui.downloads.DownloadsActivity.start(context)
                                        onDismiss()
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.Check, null, tint = Color(0xFF34D399), modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("DOWNLOADED", color = Color(0xFF34D399), fontFamily = ChesnaGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 2.sp)
                                }
                            }
                        }
                        isActive -> {
                            val activeMatch = match!!
                            // This variant is already downloading — blackish pill with a
                            // green progress stroke around the border and a white label.
                            // Tapping jumps to the downloads page.
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .focusHighlight(RoundedCornerShape(50), scale = 1.02f)
                                    .clip(RoundedCornerShape(50))
                                    .background(Color(0xFF0B0B0C))
                                    .clickable {
                                        com.snape.flix.ui.downloads.DownloadsActivity.start(context)
                                        onDismiss()
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                ProgressBorder(
                                    fraction = activeMatch.fraction,
                                    modifier = Modifier.matchParentSize(),
                                    cornerRadius = 24.dp,
                                    strokeWidth = 2.dp,
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    com.snape.flix.ui.components.DownloadGlyph(modifier = Modifier.size(16.dp), tint = Color.White)
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        if (activeMatch.status == DownloadStatus.PAUSED) "PAUSED" else "IN PROGRESS",
                                        color = Color.White,
                                        fontFamily = ChesnaGrotesk,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 12.sp,
                                        letterSpacing = 2.sp,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun enqueue(
    ready: DownloadState.Ready,
    group: SubjectGroup,
    audioIdx: Int,
    isSeries: Boolean,
    se: Int,
    ep: Int,
    quality: String,
    posterUrl: String?,
    logoUrl: String?,
    year: String,
    rating: Double?,
    subtitle: Caption? = null,
) {
    val variant = group.variants.getOrNull(audioIdx) ?: group.primary
    Downloads.enqueue(
        subjectId = variant.subjectId,
        se = se,
        ep = ep,
        title = group.primary.cleanTitle,
        isSeries = isSeries,
        posterUrl = posterUrl ?: group.primary.posterUrl,
        logoUrl = logoUrl,
        year = year.ifBlank { group.primary.year },
        rating = rating ?: group.primary.rating,
        quality = quality,
        url = ready.url,
        signCookie = ready.signCookie,
        format = ready.format,
        subtitleUrl = subtitle?.url,
        subtitleLan = subtitle?.lan ?: "",
        subtitleLanName = subtitle?.lanName ?: "",
    )
}

@Composable
private fun Field(label: String, content: @Composable () -> Unit) {
    Column {
        Text(label.uppercase(), color = Color(0x66FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { Chip(it, it == selected) { onSelect(it) } }
    }
}

/**
 * A green progress stroke swept around a pill-shaped button's border. [fraction] is
 * 0f‥1f. Drawn as a partial rounded-rect outline so the button shows download
 * progress on its edge rather than as a fill.
 */
@Composable
private fun ProgressBorder(
    fraction: Float,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    strokeWidth: Dp = 2.dp,
    track: Color = Color(0x1AFFFFFF),
    progress: Color = Color(0xFF34D399),
) {
    Canvas(modifier) {
        val sw = strokeWidth.toPx()
        val r = cornerRadius.toPx()
        val rect = Rect(sw / 2f, sw / 2f, size.width - sw / 2f, size.height - sw / 2f)
        val outline = Path().apply { addRoundRect(RoundRect(rect, CornerRadius(r, r))) }
        // Faint full track first, then the green progress arc on top.
        drawPath(outline, color = track, style = Stroke(width = sw))
        val frac = fraction.coerceIn(0f, 1f)
        if (frac > 0f) {
            val measure = PathMeasure().apply { setPath(outline, false) }
            val segment = Path()
            measure.getSegment(0f, measure.length * frac, segment, true)
            drawPath(segment, color = progress, style = Stroke(width = sw, cap = StrokeCap.Round))
        }
    }
}

@Composable
private fun Chip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .focusHighlight(RoundedCornerShape(50))
            .clip(RoundedCornerShape(50))
            .background(if (selected) Color.White else Color(0x0DFFFFFF))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (selected) Color.Black else Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}
