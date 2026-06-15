package com.snape.flix.ui.home

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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.snape.flix.data.HomeCard
import com.snape.flix.data.HomeSection
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)

/**
 * One curated provider section — a pixel replica of the web `CuratedProviderSection`.
 * A brand-tinted gradient backdrop with the TMDB hero art fading in from the
 * right (mask), the meta block (label, title logo, year/rating/RT, Watch/Explore),
 * and the poster carousel pulled up to overlap the hero's lower edge.
 */
@Composable
fun ProviderSection(
    section: HomeSection,
    onOpenCard: (HomeCard) -> Unit,
    onExplore: (label: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (section.cards.isEmpty()) return

    val brand = Color(section.brandColor)
    val heroH = 300.dp

    Box(modifier.fillMaxWidth().height(440.dp)) {

        // ── hero banner ──
        Box(Modifier.fillMaxWidth().height(heroH)) {
            // brand gradient: #070b08 → brand@30% → brand@55% (left → right)
            Box(
                Modifier.fillMaxSize().background(
                    Brush.horizontalGradient(
                        0.0f to PageBg,
                        0.28f to PageBg,
                        0.58f to brand.copy(alpha = 0.19f),
                        1.0f to brand.copy(alpha = 0.33f),
                    ),
                ),
            )

            // TMDB backdrop on the right, masked to fade in from its left edge.
            section.heroBackdropUrl?.let { url ->
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    alignment = Alignment.TopCenter,
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .fillMaxHeight()
                        .fillMaxWidth(0.62f)
                        .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
                        .drawWithContent {
                            drawContent()
                            drawRect(
                                brush = Brush.horizontalGradient(
                                    0.08f to Color.Transparent,
                                    0.42f to Color.Black,
                                ),
                                blendMode = BlendMode.DstIn,
                            )
                        },
                )
            }

            // top + bottom vignettes blending into the page bg
            Box(
                Modifier.align(Alignment.TopCenter).fillMaxWidth().fillMaxHeight(0.2f)
                    .background(Brush.verticalGradient(0f to PageBg, 1f to Color.Transparent)),
            )
            Box(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(0.4f)
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Transparent,
                            0.5f to PageBg.copy(alpha = 0.6f),
                            1f to PageBg,
                        ),
                    ),
            )

            // ── meta block (left, ~41% down) ──
            Column(
                Modifier
                    .align(Alignment.CenterStart)
                    .offset(y = (-18).dp)
                    .fillMaxWidth(0.62f)
                    .padding(start = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = section.label.uppercase(),
                    color = Color.White,
                    fontFamily = ChesnaGrotesk,
                    fontWeight = FontWeight.Light,
                    fontSize = 22.sp,
                    letterSpacing = 4.sp,
                )

                if (section.heroLogoUrl != null) {
                    AsyncImage(
                        model = section.heroLogoUrl,
                        contentDescription = section.heroTitle,
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.CenterStart,
                        modifier = Modifier.heightIn(max = 56.dp).widthIn(max = 170.dp),
                    )
                } else {
                    Text(
                        text = section.heroTitle,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                // year chip (mobile shows only the year chip, like the web)
                section.heroYear?.let { year ->
                    Text(
                        text = year,
                        color = Color(0xB3FFFFFF),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .border(1.dp, Color(0x59FFFFFF), RoundedCornerShape(20.dp))
                            .padding(horizontal = 10.dp, vertical = 2.dp),
                    )
                }

                // HD · ★rating · 🍅rt%
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("HD", color = Color(0xB3FFFFFF), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                    section.heroRating?.let { r ->
                        Text("★ $r", color = Color(0xB3FFFFFF), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                    }
                    section.rtScore?.let { rt ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            AsyncImage(
                                model = "file:///android_asset/fresh-tomato-logo.png",
                                contentDescription = null,
                                modifier = Modifier.size(13.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "$rt%",
                                color = if (rt >= 60) Color(0xFF86EFAC) else Color(0xFFFCA5A5),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MetaButton("WATCH", primary = true) { section.cards.firstOrNull()?.let(onOpenCard) }
                    MetaButton("EXPLORE ${section.label.uppercase()}", primary = false) { onExplore(section.label) }
                }
            }
        }

        // ── poster carousel — pulled up to overlap the hero's lower edge ──
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(horizontal = 20.dp),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(bottom = 8.dp),
        ) {
            items(section.cards, key = { (it.subject?.subjectId ?: it.tmdbId.toString()) + it.title }) { card ->
                HomePosterCard(card = card, onClick = { onOpenCard(card) })
            }
        }
    }
}

/** Portrait poster card for the home carousels (web `ProviderCard`). */
@Composable
private fun HomePosterCard(card: HomeCard, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        Modifier
            .width(130.dp)
            .clip(shape)
            .background(Color(0x0DFFFFFF))
            .border(1.dp, Color(0x40FFFFFF), shape)
            .clickable(onClick = onClick)
            .aspectRatio(2f / 3f),
    ) {
        if (card.posterUrl != null) {
            AsyncImage(
                model = card.posterUrl,
                contentDescription = card.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No Image", color = Color(0x33FFFFFF), fontSize = 11.sp)
            }
        }

        // type chip — top-left
        Chip(if (card.isSeries) "SERIES" else "FILM", Modifier.align(Alignment.TopStart).padding(6.dp))
        // rating chip — top-right
        card.rating?.let { r ->
            Chip("★ ${"%.1f".format(r)}", Modifier.align(Alignment.TopEnd).padding(6.dp))
        }

        // title bar — bottom
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000)))
                .padding(horizontal = 8.dp, vertical = 5.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = card.title.uppercase(),
                color = Color(0xE6FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontWeight = FontWeight.Light,
                fontSize = 10.sp,
                letterSpacing = 1.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun Chip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0x99000000))
            .border(0.5.dp, Color(0x66FFFFFF), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(text, color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
    }
}

@Composable
private fun MetaButton(label: String, primary: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        Modifier
            .height(32.dp)
            .clip(shape)
            .then(
                if (primary) Modifier.background(Color.White)
                else Modifier.background(Color(0x1AFFFFFF)).border(1.dp, Color(0x33FFFFFF), shape),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (primary) {
                Text("▶", color = Color.Black, fontSize = 9.sp)
                Spacer(Modifier.width(6.dp))
            }
            Text(
                text = label,
                color = if (primary) Color.Black else Color.White,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
