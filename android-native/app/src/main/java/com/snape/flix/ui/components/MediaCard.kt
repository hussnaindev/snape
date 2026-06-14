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
import androidx.compose.runtime.remember
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
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.snape.flix.data.SubjectItem

private val CardBg = Color(0x0DFFFFFF) // bg-white/5
private val CardRing = Color(0x40FFFFFF) // ring-white/25
private val ChipBg = Color(0x99000000) // bg-black/60
private val ChipBorder = Color(0x66FFFFFF) // border-white/40
private val ChipText = Color(0xCCFFFFFF) // text-white/80
private val TitleText = Color(0xE6FFFFFF) // text-white/90

/**
 * Portrait poster card matching the web UI: 2:3 poster, rounded corners, a faint
 * white hairline ring, language/rating chips, and a gradient title bar.
 */
@Composable
fun MediaCard(item: SubjectItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(16.dp)
    val displayTitle = remember(item.title) { item.cleanTitle() }
    val languageLabel = remember(item.corner) { item.languageLabel() }
    val ratingText = remember(item.imdbRatingValue) {
        item.rating?.takeIf { it > 0 }?.let { "★ ${"%.1f".format(it)}" }
    }
    val context = LocalContext.current

    Box(
        modifier = modifier
            .clip(shape)
            .background(CardBg)
            .border(1.dp, CardRing, shape)
            .clickable(onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f)) {
            if (item.posterUrl != null) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(item.posterUrl)
                        .size(240, 360)
                        .crossfade(false)
                        .memoryCachePolicy(CachePolicy.ENABLED)
                        .diskCachePolicy(CachePolicy.ENABLED)
                        .build(),
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    Modifier.fillMaxSize().background(CardBg),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("No Image", color = Color(0x33FFFFFF), fontSize = 11.sp)
                }
            }

            // language chip — top-left (replaces Film/Series on web browse cards)
            Chip(
                text = languageLabel,
                modifier = Modifier.align(Alignment.TopStart).padding(horizontal = 8.dp, vertical = 6.dp),
            )

            // rating chip — top-right
            ratingText?.let { text ->
                Chip(
                    text = text,
                    modifier = Modifier.align(Alignment.TopEnd).padding(horizontal = 8.dp, vertical = 6.dp),
                )
            }

            // gradient title bar — bottom
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            0f to Color(0x80000000), // black/50
                            1f to Color(0xD9000000), // black/85
                        ),
                    )
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    text = displayTitle,
                    color = TitleText,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Light,
                    letterSpacing = 2.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().align(Alignment.Center),
                )
            }
        }
    }
}

/** Strip the trailing "[Hindi]"/"[Tamil]" tag; the language chip already shows it. */
private fun SubjectItem.cleanTitle(): String =
    title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim().uppercase()

private fun SubjectItem.languageLabel(): String =
    corner.trim().ifBlank { "Original" }.uppercase()

@Composable
private fun Chip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(50))
            .background(ChipBg)
            .border(1.dp, ChipBorder, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = text,
            color = ChipText,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.5.sp,
        )
    }
}
