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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BookmarkAdded
import androidx.compose.material3.Icon
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
fun MediaCard(item: SubjectItem, onClick: () -> Unit, modifier: Modifier = Modifier, chipText: String? = null) {
    PosterCard(
        posterUrl = item.posterUrl,
        isSeries = item.isSeries,
        rating = item.rating?.takeIf { it > 0 },
        title = item.cleanTitle,
        onClick = onClick,
        chipText = chipText,
        modifier = modifier.fillMaxWidth(),
    )
}

/**
 * The canonical poster card used across the app (search results, "more like
 * this", and the home carousels): a 2:3 poster, faint white ring, a type chip
 * (top-left), a rating chip (top-right) and the gradient title overlay. Callers
 * size it via [modifier] (grid cell → fillMaxWidth, carousel → fixed width).
 *
 * On the watchlist page the rating chip is replaced by a filled watchlist icon:
 * pass [onWatchlistRemove] (non-null) and tapping it removes the title from the
 * list. When null the card shows the usual rating chip.
 */
@Composable
fun PosterCard(
    posterUrl: String?,
    isSeries: Boolean,
    rating: Double?,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onWatchlistRemove: (() -> Unit)? = null,
    progress: Float? = null,
    chipText: String? = null,
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

        // type chip — top-left (Film / Series / studio name), mirroring the web card
        Chip(
            text = chipText ?: if (isSeries) "SERIES" else "FILM",
            modifier = Modifier.align(Alignment.TopStart).padding(5.dp),
        )

        // top-right — either the rating chip, or (watchlist page) a filled
        // watchlist icon that removes the title when tapped.
        if (onWatchlistRemove != null) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(5.dp)
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(Color.White)
                    .clickable(onClick = onWatchlistRemove),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Rounded.BookmarkAdded,
                    contentDescription = "Remove from watchlist",
                    tint = Color.Black,
                    modifier = Modifier.size(15.dp),
                )
            }
        } else {
            rating?.let { r ->
                Chip(
                    text = "★ ${"%.1f".format(r)}",
                    modifier = Modifier.align(Alignment.TopEnd).padding(5.dp),
                )
            }
        }

        // gradient title bar — bottom. Padding-based band (matching the detail
        // page's "More Like This" cards) so the strip scales with the title.
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(TitleScrim)
                .padding(horizontal = 6.dp, vertical = 5.dp),
        ) {
            Text(
                text = title.uppercase(),
                color = Color(0xE6FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontSize = 9.sp,
                fontWeight = FontWeight.Light,
                letterSpacing = 1.2.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        // resume progress bar — sits flush on the card's bottom edge (Continue
        // Watching), drawn over the title scrim.
        if (progress != null && progress > 0f) {
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(3.dp)
                    .background(Color(0x40FFFFFF)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(progress.coerceIn(0f, 1f))
                        .height(3.dp)
                        .background(Color(0xFFFF0000)),
                )
            }
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
            // matches the detail page's "More Like This" MiniChip ratio.
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 8.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.3.sp,
            // No font padding → the pill hugs the text, so it reads slim not round.
            style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
        )
    }
}
