package com.snape.flix.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.snape.flix.data.SubjectItem

/**
 * Portrait poster card matching the web UI: 2:3 poster, rounded corners, a faint
 * white hairline ring, type/rating chips, a language pill, and a gradient title bar.
 */
@Composable
fun MediaCard(item: SubjectItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(18.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(Color(0x14FFFFFF))
            .border(1.dp, Color(0x40FFFFFF), shape)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f)) {
            if (item.posterUrl != null) {
                AsyncImage(
                    model = item.posterUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    Modifier.fillMaxSize().background(Color(0x14FFFFFF)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("No Image", color = Color(0x33FFFFFF), fontSize = 11.sp)
                }
            }

            // type chip — top-left
            Chip(
                text = if (item.isSeries) "SERIES" else "FILM",
                modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
            )

            // rating chip — top-right
            item.rating?.let { r ->
                if (r > 0) {
                    Chip(
                        text = "★ ${"%.1f".format(r)}",
                        modifier = Modifier.align(Alignment.TopEnd).padding(8.dp),
                    )
                }
            }

            // language pill (variant tag e.g. Hindi/Tamil) — bottom-left above title
            if (item.corner.isNotBlank()) {
                Chip(
                    text = item.corner.uppercase(),
                    modifier = Modifier.align(Alignment.BottomStart).padding(8.dp).padding(bottom = 28.dp),
                )
            }

            // gradient title bar — bottom
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Transparent,
                            1f to Color(0xD9000000),
                        ),
                    )
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            ) {
                Text(
                    text = item.cleanTitle(),
                    color = Color(0xE6FFFFFF),
                    fontSize = 11.sp,
                    letterSpacing = 1.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().align(Alignment.Center),
                )
            }
        }
    }
}

/** Strip the trailing "[Hindi]"/"[Tamil]" tag; the language pill already shows it. */
private fun SubjectItem.cleanTitle(): String =
    title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim().uppercase()

@Composable
private fun Chip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0x99000000))
            .border(1.dp, Color(0x66FFFFFF), RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(text = text, color = Color(0xCCFFFFFF), fontSize = 9.sp, letterSpacing = 1.sp)
    }
}
