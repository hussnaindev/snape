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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.snape.flix.data.HomeCard
import com.snape.flix.data.HomeSection
import com.snape.flix.ui.components.PosterCard
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

            // TMDB backdrop on the right, faded into the page bg from its left
            // edge. A plain gradient overlay (SrcOver) — no offscreen layer or
            // per-frame blend pass, so it stays cheap while scrolling.
            section.heroBackdropUrl?.let { url ->
                Box(
                    Modifier
                        .align(Alignment.CenterEnd)
                        .fillMaxHeight()
                        .fillMaxWidth(0.62f),
                ) {
                    AsyncImage(
                        model = url,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        alignment = Alignment.TopCenter,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(
                        Modifier.fillMaxSize().background(
                            Brush.horizontalGradient(
                                0.0f to PageBg,
                                0.45f to Color.Transparent,
                            ),
                        ),
                    )
                }
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

                // Title logo — fixed footprint so every section's logo reserves
                // the same space and is contained (never cropped/truncated).
                Box(Modifier.height(48.dp).width(160.dp), contentAlignment = Alignment.CenterStart) {
                    if (section.heroLogoUrl != null) {
                        AsyncImage(
                            model = section.heroLogoUrl,
                            contentDescription = section.heroTitle,
                            contentScale = ContentScale.Fit,
                            alignment = Alignment.CenterStart,
                            modifier = Modifier.fillMaxSize(),
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
                }

                // Year chip first, then HD · ★rating · 🍅rt% — one row.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    section.heroYear?.let { year ->
                        Text(
                            text = year,
                            color = Color(0xCCFFFFFF),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0x1FFFFFFF))
                                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(6.dp))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
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
                PosterCard(
                    posterUrl = card.posterUrl,
                    isSeries = card.isSeries,
                    rating = card.rating,
                    title = card.title,
                    onClick = { onOpenCard(card) },
                    modifier = Modifier.width(130.dp),
                )
            }
        }
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
