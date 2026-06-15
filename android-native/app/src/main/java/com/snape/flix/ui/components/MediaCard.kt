package com.snape.flix.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.snape.flix.data.SubjectItem
import com.snape.flix.ui.theme.ChesnaGrotesk

// Hoisted so they are not reallocated for every card on every recomposition
// while the grid scrolls.
private val CardShape = RoundedCornerShape(16.dp) // web mobile: rounded-2xl
private val ChipShape = RoundedCornerShape(50) // pill (web: rounded-full)
private val TitleScrim = Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000))

private val CardSurface = Color(0x0DFFFFFF) // white @ 5%   (web: bg-white/5)
private val CardRing = Color(0x40FFFFFF) // white @ 25%      (web: ring-white/25)
private val ChipBg = Color(0x99000000) // black @ 60%        (web: bg-black/60)
private val ChipBorder = Color(0x66FFFFFF) // white @ 40%    (web: border-white/40)

/**
 * Portrait poster card matching the web UI: a 2:3 poster, rounded corners, a
 * faint white ring, a language chip (top-left), a rating chip (top-right) and a
 * gradient title bar. Mirrors `components/movie-card.tsx`, except the type chip
 * (Film/Series) is replaced by the audio-language chip (Original/Hindi/Tamil…).
 */
@Composable
fun MediaCard(item: SubjectItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    PosterCard(
        posterUrl = item.posterUrl,
        isSeries = item.isSeries,
        rating = item.rating?.takeIf { it > 0 },
        title = item.cleanTitle,
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
    )
}

/**
 * The canonical poster card used across the app (search results, "more like
 * this", and the home carousels): a 2:3 poster, faint white ring, a type chip
 * (top-left), a rating chip (top-right) and the gradient title overlay. Callers
 * size it via [modifier] (grid cell → fillMaxWidth, carousel → fixed width).
 */
@Composable
fun PosterCard(
    posterUrl: String?,
    isSeries: Boolean,
    rating: Double?,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(CardShape)
            .background(CardSurface)
            .border(1.dp, CardRing, CardShape) // web mobile: ring-1
            .clickable(onClick = onClick)
            .aspectRatio(2f / 3f),
    ) {
        if (posterUrl != null) {
            AsyncImage(
                model = posterUrl,
                contentDescription = title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(
                Modifier.fillMaxSize().background(CardSurface),
                contentAlignment = Alignment.Center,
            ) {
                Text("No Image", color = Color(0x33FFFFFF), fontSize = 11.sp)
            }
        }

        // type chip — top-left (Film / Series), mirroring the web card
        Chip(
            text = if (isSeries) "SERIES" else "FILM",
            modifier = Modifier.align(Alignment.TopStart).padding(5.dp),
        )

        // rating chip — top-right
        rating?.let { r ->
            Chip(
                text = "★ ${"%.1f".format(r)}",
                modifier = Modifier.align(Alignment.TopEnd).padding(5.dp),
            )
        }

        // gradient title bar — bottom. A taller band with the title vertically
        // centered (contentAlignment) so it reads as a proper overlay strip.
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(20.dp)
                .background(TitleScrim)
                .padding(horizontal = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = title.uppercase(),
                color = Color(0xE6FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontSize = 9.sp,
                lineHeight = 9.sp,
                fontWeight = FontWeight.Light,
                letterSpacing = 1.2.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                // Drop the font's built-in top/bottom padding so it sits exactly
                // on the band's vertical center.
                style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun Chip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(ChipShape)
            .background(ChipBg)
            .border(0.5.dp, ChipBorder, ChipShape)
            // slim pill: vertical padding ~half the horizontal and kept minimal.
            .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 7.sp,
            lineHeight = 7.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.3.sp,
            // No font padding → the pill hugs the text, so it reads slim not round.
            style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
        )
    }
}
