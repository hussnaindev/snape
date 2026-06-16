package com.snape.flix.ui.detail

import android.widget.Toast
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.snape.flix.data.Downloads
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.theme.ChesnaGrotesk

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
    vm: DownloadViewModel = viewModel(),
) {
    val se = if (isSeries) 1 else 0
    val ep = if (isSeries) 1 else 0
    val context = LocalContext.current

    var audioIdx by remember { mutableIntStateOf(0) }
    var quality by remember { mutableStateOf("") }
    var subIdx by remember { mutableIntStateOf(-1) }

    androidx.compose.runtime.LaunchedEffect(audioIdx) {
        val variant = group.variants.getOrNull(audioIdx) ?: return@LaunchedEffect
        vm.load(variant.subjectId, se, ep)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Reset the quality default whenever a freshly-resolved stream arrives.
    androidx.compose.runtime.LaunchedEffect(state) {
        val ready = state as? DownloadState.Ready ?: return@LaunchedEffect
        quality = ready.qualities.firstOrNull { it == "720p" }
            ?: ready.qualities.firstOrNull { it == "480p" }
            ?: ready.qualities.firstOrNull()
            ?: "Auto"
        subIdx = -1
    }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val heading = if (isSeries) "${group.primary.title} · S$se E$ep" else group.primary.title

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
                    if (st.qualities.isNotEmpty()) {
                        Field("Quality") {
                            ChipRow(st.qualities, quality) { quality = it }
                        }
                    }
                    if (group.variants.size > 1) {
                        Spacer(Modifier.height(16.dp))
                        Field("Language / Audio") {
                            ChipRow(group.variants.map { it.variantLabel }, group.variants[audioIdx].variantLabel) { label ->
                                audioIdx = group.variants.indexOfFirst { it.variantLabel == label }.coerceAtLeast(0)
                            }
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
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color.White)
                            .clickable {
                                enqueue(st, group, audioIdx, isSeries, se, ep, quality, posterUrl, logoUrl, year, rating)
                                Toast.makeText(context, "Download started", Toast.LENGTH_SHORT).show()
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

@Composable
private fun Chip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
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
