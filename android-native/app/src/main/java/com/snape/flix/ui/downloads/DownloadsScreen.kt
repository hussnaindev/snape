package com.snape.flix.ui.downloads

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import com.snape.flix.ui.tv.focusHighlight
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.snape.flix.data.DownloadItem
import com.snape.flix.data.DownloadStatus
import com.snape.flix.data.Downloads
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.components.PullToRefresh
import com.snape.flix.ui.theme.ChesnaGrotesk
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val PageBg = Color(0xFF070B08)
private val GreenBrush = Brush.horizontalGradient(listOf(Color(0xFF34D399), Color(0xFF059669)))

@Composable
fun DownloadsScreen(onBack: () -> Unit) {
    val items by Downloads.items.collectAsStateWithLifecycle()
    val removingIds by Downloads.removingIds.collectAsStateWithLifecycle()
    val resumingIds by Downloads.resumingIds.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }

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
                PullToRefresh(
                    isRefreshing = refreshing,
                    onRefresh = {
                        if (!refreshing) {
                            refreshing = true
                            scope.launch {
                                Downloads.reload()
                                delay(400) // brief feedback — the reload itself is instant
                                refreshing = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxSize(),
                ) {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(items, key = { it.id }) { item ->
                            DownloadRow(item, item.id in resumingIds, item.id in removingIds)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DownloadRow(item: DownloadItem, isResuming: Boolean, isRemoving: Boolean) {
    val context = LocalContext.current
    var confirmDelete by remember { mutableStateOf(false) }
    if (confirmDelete) {
        ConfirmDeleteDialog(
            title = item.title,
            onConfirm = {
                confirmDelete = false
                Downloads.cancel(item.id)
            },
            onDismiss = { confirmDelete = false },
        )
    }
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

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (item.year.isNotBlank()) Chip(item.year)
                item.rating?.takeIf { it > 0 }?.let { Chip("★ ${"%.1f".format(it)}") }
                item.quality.takeIf { it.isNotBlank() }?.let { Chip(it) }
            }

            Spacer(Modifier.height(8.dp))

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
                            DownloadStatus.REMOVING -> "Deleting…"
                            else -> "$sizeLabel · $pct%"
                        },
                        color = if (item.status == DownloadStatus.FAILED) Color(0xFFF87171) else Color(0x99FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 10.sp,
                    )
                }
            }
        }

        // Fixed-size action buttons (80×36dp)
        Column(
            modifier = Modifier.align(Alignment.CenterVertically),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.End,
        ) {
            when (item.status) {
                DownloadStatus.COMPLETED ->
                    ActionButton(icon = Icons.Rounded.PlayArrow, label = "Play", accent = true) {
                        OfflinePlayerActivity.start(context, item.id)
                    }
                DownloadStatus.RUNNING, DownloadStatus.QUEUED ->
                    ActionButton(icon = Icons.Rounded.Pause, label = "Pause") { Downloads.pause(item.id) }
                DownloadStatus.PAUSED, DownloadStatus.FAILED ->
                    if (isResuming) {
                        ActionButtonLoading(label = "Resume")
                    } else {
                        ActionButton(icon = Icons.Rounded.Download, label = "Resume", accent = true) { Downloads.resume(item.id) }
                    }
                DownloadStatus.REMOVING ->
                    ActionButtonLoading(label = "Delete")
            }
            if (item.status == DownloadStatus.COMPLETED) {
                if (isRemoving) {
                    ActionButtonLoading(label = "Deleting")
                } else {
                    ActionButton(icon = Icons.Rounded.DeleteOutline, label = "Delete", danger = true) { confirmDelete = true }
                }
            } else if (item.status != DownloadStatus.REMOVING) {
                if (isRemoving) {
                    ActionButtonLoading(label = "Deleting")
                } else {
                    ActionButton(icon = Icons.Rounded.Close, label = "Cancel") { Downloads.cancel(item.id) }
                }
            }
        }
    }
}

/** Fixed-size 80×36dp button — icon + label, dimensions never change. */
@Composable
private fun ActionButton(
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
            .width(80.dp)
            .height(36.dp)
            .focusHighlight(RoundedCornerShape(50))
            .clip(RoundedCornerShape(50))
            .background(if (accent) Color.White else Color(0x14FFFFFF))
            .border(1.dp, if (accent) Color.White else Color(0x26FFFFFF), RoundedCornerShape(50))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = label, tint = content, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(5.dp))
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

/** Fixed-size 80×36dp button with a loading spinner instead of an icon. */
@Composable
private fun ActionButtonLoading(label: String) {
    Row(
        Modifier
            .width(80.dp)
            .height(36.dp)
            .clip(RoundedCornerShape(50))
            .background(Color(0x14FFFFFF))
            .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(50)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(14.dp),
            color = Color(0xCCFFFFFF),
            strokeWidth = 2.dp,
        )
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            color = Color(0xCCFFFFFF),
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.Medium,
            fontSize = 10.sp,
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

/**
 * Confirmation guard for the irreversible Delete action — a misclick on the small
 * row button shouldn't wipe a saved file. Dark, app-styled modal with Cancel /
 * Delete actions.
 */
@Composable
private fun ConfirmDeleteDialog(title: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFF111613))
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(20.dp))
                .padding(20.dp),
        ) {
            Text(
                "Delete download?",
                color = Color.White,
                fontFamily = ChesnaGrotesk,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "“$title” will be removed from your device. This can't be undone.",
                color = Color(0x99FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontSize = 13.sp,
            )
            Spacer(Modifier.height(20.dp))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier
                        .weight(1f)
                        .height(44.dp)
                        .focusHighlight(RoundedCornerShape(50), scale = 1.03f)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0x14FFFFFF))
                        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(50))
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("CANCEL", color = Color.White, fontFamily = ChesnaGrotesk, fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 1.sp)
                }
                Box(
                    Modifier
                        .weight(1f)
                        .height(44.dp)
                        .focusHighlight(RoundedCornerShape(50), scale = 1.03f)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0x1AF87171))
                        .border(1.dp, Color(0x66F87171), RoundedCornerShape(50))
                        .clickable(onClick = onConfirm),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("DELETE", color = Color(0xFFF87171), fontFamily = ChesnaGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 1.sp)
                }
            }
        }
    }
}

private fun formatSize(bytes: Long): String {
    val mb = bytes / (1024.0 * 1024.0)
    return if (mb >= 1024) "%.2f GB".format(mb / 1024.0) else "%.0f MB".format(mb)
}
