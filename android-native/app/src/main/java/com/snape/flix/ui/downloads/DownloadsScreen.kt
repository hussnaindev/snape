package com.snape.flix.ui.downloads

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.snape.flix.data.DownloadItem
import com.snape.flix.data.DownloadStatus
import com.snape.flix.data.Downloads
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)
private val GreenBrush = Brush.horizontalGradient(listOf(Color(0xFF34D399), Color(0xFF059669)))

/**
 * The downloads library — active downloads and completed offline titles in one
 * list. Each row shows the poster, the title logo (falling back to plain text),
 * size / year / rating chips, a completion percentage and the controls: pause or
 * resume, cancel, and (when complete) play offline.
 */
@Composable
fun DownloadsScreen(onBack: () -> Unit) {
    val items by Downloads.items.collectAsStateWithLifecycle()

    Box(Modifier.fillMaxSize().background(PageBg)) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth()) {
                BackChip(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(top = 16.dp, bottom = 20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    LinedHeading("Downloads", modifier = Modifier.padding(horizontal = 56.dp))
                }
            }

            if (items.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "No downloads yet.\nTap the download icon on any title to save it offline.",
                        color = Color(0x80FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(32.dp),
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(items, key = { it.id }) { item -> DownloadRow(item) }
                }
            }
        }
    }
}

@Composable
private fun DownloadRow(item: DownloadItem) {
    val context = LocalContext.current
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0x0DFFFFFF))
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(14.dp))
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // poster
        Box(
            Modifier
                .width(64.dp)
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0x0DFFFFFF)),
        ) {
            if (item.posterUrl != null) {
                AsyncImage(
                    model = item.posterUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        Column(Modifier.weight(1f)) {
            // title — logo image, or plain text fallback
            if (item.logoUrl != null) {
                AsyncImage(
                    model = item.logoUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.CenterStart,
                    modifier = Modifier.height(26.dp).fillMaxWidth(0.85f),
                )
            } else {
                Text(
                    item.title.uppercase(),
                    color = Color(0xE6FFFFFF),
                    fontFamily = ChesnaGrotesk,
                    fontWeight = FontWeight.Light,
                    fontSize = 14.sp,
                    letterSpacing = 1.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (item.isSeries) {
                Spacer(Modifier.height(2.dp))
                Text(item.episodeLabel, color = Color(0x99FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 11.sp)
            }

            Spacer(Modifier.height(8.dp))

            // chips: year · rating · quality (size is shown with the progress below)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (item.year.isNotBlank()) Chip(item.year)
                item.rating?.takeIf { it > 0 }?.let { Chip("★ ${"%.1f".format(it)}") }
                item.quality.takeIf { it.isNotBlank() }?.let { Chip(it) }
            }

            Spacer(Modifier.height(8.dp))

            // "120 MB / 450 MB" — bytes done over total (total unknown until probed).
            val done = formatSize(item.bytesDownloaded)
            val sizeLabel = if (item.contentLength > 0) "$done / ${formatSize(item.contentLength)}" else done

            when (item.status) {
                DownloadStatus.COMPLETED -> Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        Icons.Rounded.CheckCircle,
                        contentDescription = "Downloaded",
                        tint = Color(0xFF34D399),
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        formatSize(if (item.contentLength > 0) item.contentLength else item.bytesDownloaded),
                        color = Color(0x99FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 11.sp,
                    )
                }
                else -> {
                    // thin green progress bar + bytes/percentage
                    val pct = (item.fraction * 100).toInt()
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color(0x26FFFFFF)),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(item.fraction)
                                .height(4.dp)
                                .clip(RoundedCornerShape(50))
                                .background(GreenBrush),
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        when (item.status) {
                            DownloadStatus.PAUSED -> "Paused · $sizeLabel · $pct%"
                            DownloadStatus.FAILED -> "Failed · tap to retry"
                            else -> "$sizeLabel · $pct%"
                        },
                        color = if (item.status == DownloadStatus.FAILED) Color(0xFFF87171) else Color(0x99FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 10.sp,
                    )
                }
            }
        }

        // controls — icon + label buttons, vertically centered against the row
        Column(
            modifier = Modifier.align(Alignment.CenterVertically),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.End,
        ) {
            when (item.status) {
                DownloadStatus.COMPLETED ->
                    LabelButton(Icons.Rounded.PlayArrow, "Play", accent = true) {
                        OfflinePlayerActivity.start(context, item.id)
                    }
                DownloadStatus.RUNNING, DownloadStatus.QUEUED ->
                    LabelButton(Icons.Rounded.Pause, "Pause") { Downloads.pause(item.id) }
                DownloadStatus.PAUSED, DownloadStatus.FAILED ->
                    LabelButton(Icons.Rounded.Download, "Resume", accent = true) { Downloads.resume(item.id) }
            }
            if (item.status == DownloadStatus.COMPLETED) {
                LabelButton(Icons.Rounded.DeleteOutline, "Delete", danger = true) { Downloads.cancel(item.id) }
            } else {
                LabelButton(Icons.Rounded.Close, "Cancel") { Downloads.cancel(item.id) }
            }
        }
    }
}

@Composable
private fun LabelButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    accent: Boolean = false,
    danger: Boolean = false,
    onClick: () -> Unit,
) {
    val content = when {
        accent -> Color.Black
        danger -> Color(0xFFF87171)
        else -> Color.White
    }
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(if (accent) Color.White else Color(0x14FFFFFF))
            .border(1.dp, if (accent) Color.White else Color(0x26FFFFFF), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(icon, contentDescription = label, tint = content, modifier = Modifier.size(15.dp))
        Text(
            label,
            color = content,
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            letterSpacing = 0.3.sp,
        )
    }
}

@Composable
private fun Chip(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0x14FFFFFF))
            .border(0.5.dp, Color(0x26FFFFFF), RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(text, color = Color(0xCCFFFFFF), fontFamily = ChesnaGrotesk, fontWeight = FontWeight.Medium, fontSize = 9.sp, letterSpacing = 0.4.sp)
    }
}

private fun formatSize(bytes: Long): String {
    val mb = bytes / (1024.0 * 1024.0)
    return if (mb >= 1024) "%.2f GB".format(mb / 1024.0) else "%.0f MB".format(mb)
}
