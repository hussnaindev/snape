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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.snape.flix.data.SubjectItem

// Hoisted so they are not reallocated for every card on every recomposition
// while the grid scrolls.
private val CardShape = RoundedCornerShape(24.dp)
private val ChipShape = RoundedCornerShape(50)
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
    Box(
        modifier = modifier
            .clip(CardShape)
            .background(CardSurface)
            .border(2.dp, CardRing, CardShape)
            .clickable(onClick = onClick)
            .fillMaxWidth()
            .aspectRatio(2f / 3f),
    ) {
        if (item.posterUrl != null) {
            AsyncImage(
                model = item.posterUrl,
                contentDescription = item.title,
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

        // language chip — top-left (Original / Hindi / Tamil …)
        Chip(
            text = item.corner.ifBlank { "Original" }.uppercase(),
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

        // gradient title bar — bottom
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(TitleScrim)
                .padding(horizontal = 8.dp, vertical = 8.dp),
        ) {
            Text(
                text = item.cleanTitle(),
                color = Color(0xE6FFFFFF),
                fontSize = 11.sp,
                fontWeight = FontWeight.Light,
                letterSpacing = 1.6.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().align(Alignment.Center),
            )
        }
    }
}

/** Strip the trailing "[Hindi]"/"[Tamil]" tag; the language chip already shows it. */
private fun SubjectItem.cleanTitle(): String =
    title.replace(Regex("\\s*\\[[^]]*]\\s*$"), "").trim().uppercase()

@Composable
private fun Chip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(ChipShape)
            .background(ChipBg)
            .border(1.dp, ChipBorder, ChipShape)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.sp,
        )
    }
}
