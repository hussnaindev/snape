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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
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

            // chips: size · year · rating
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                val sizeBytes = if (item.contentLength > 0) item.contentLength else item.bytesDownloaded
                if (sizeBytes > 0) Chip(formatSize(sizeBytes))
                if (item.year.isNotBlank()) Chip(item.year)
                item.rating?.takeIf { it > 0 }?.let { Chip("★ ${"%.1f".format(it)}") }
                item.quality.takeIf { it.isNotBlank() }?.let { Chip(it) }
            }

            Spacer(Modifier.height(8.dp))

            when (item.status) {
                DownloadStatus.COMPLETED -> Text(
                    "Downloaded",
                    color = Color(0xFF34D399),
                    fontFamily = ChesnaGrotesk,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    letterSpacing = 0.5.sp,
                )
                else -> {
                    // thin green progress bar + percentage
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
                            DownloadStatus.PAUSED -> "Paused · $pct%"
                            DownloadStatus.FAILED -> "Failed · tap to retry"
                            else -> "$pct%"
                        },
                        color = if (item.status == DownloadStatus.FAILED) Color(0xFFF87171) else Color(0x99FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 10.sp,
                    )
                }
            }
        }

        // controls
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            when (item.status) {
                DownloadStatus.COMPLETED -> {
                    CircleButton(Icons.Rounded.PlayArrow, "Play", filled = true) {
                        OfflinePlayerActivity.start(context, item.id)
                    }
                }
                DownloadStatus.RUNNING, DownloadStatus.QUEUED -> {
                    CircleButton(Icons.Rounded.Pause, "Pause") { Downloads.pause(item.id) }
                }
                DownloadStatus.PAUSED, DownloadStatus.FAILED -> {
                    CircleButton(Icons.Rounded.Download, "Resume") { Downloads.resume(item.id) }
                }
            }
            CircleButton(Icons.Rounded.Close, "Cancel") { Downloads.cancel(item.id) }
        }
    }
}

@Composable
private fun CircleButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    desc: String,
    filled: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(if (filled) Color.White else Color(0x14FFFFFF))
            .border(1.dp, if (filled) Color.White else Color(0x26FFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = desc, tint = if (filled) Color.Black else Color.White, modifier = Modifier.size(17.dp))
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
