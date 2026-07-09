package com.snape.flix.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
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
import com.snape.flix.ui.tv.focusHighlight

private val PageBg = Color(0xFF070B08)

// Single hoisted vertical fade carrying BOTH the top and bottom vignettes, so the
// banner dissolves into the rows above/below with one draw instead of two. The
// horizontal fade (brand tint + left legibility ramp) is brand-dependent, so it's
// built per section in drawWithCache below. Two gradient rects total, not four —
// halving the overlay fill-rate that was dropping frames while scrolling.
private val VFade = Brush.verticalGradient(
    0.0f to PageBg,
    0.24f to Color.Transparent,
    0.55f to Color.Transparent,
    0.74f to PageBg.copy(alpha = 0.80f),
    1.0f to PageBg,
)
private val ChipShape = RoundedCornerShape(50)

private val HeroHeight = 300.dp
private val SectionHeight = 440.dp

/**
 * One curated provider section — a pixel replica of the web `CuratedProviderSection`.
 * A full-width landscape banner (the TMDB backdrop) that fades out toward the left
 * for metadata legibility, a brand-tinted overlay, the meta block (label, contained
 * title logo, year/rating/RT, Watch/Explore) and the poster carousel pulled up to
 * overlap the banner's lower edge.
 *
 * Performance: every gradient is painted in a single cached [drawWithCache] pass
 * rather than as a stack of translucent `Box(background=…)` layout nodes, so the
 * section is cheap to measure and draw while the home list scrolls.
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

    Box(modifier.fillMaxWidth().height(SectionHeight)) {

        // ── hero banner ──
        Box(Modifier.fillMaxWidth().height(HeroHeight)) {

            if (section.heroBackdropUrl != null) {
                AsyncImage(
                    model = section.heroBackdropUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    alignment = Alignment.CenterStart,
                    modifier = Modifier
                        .fillMaxSize()
                        .then(
                            if (section.backdropOffsetX != 0f)
                                Modifier.offset(x = section.backdropOffsetX.dp)
                            else Modifier
                        ),
                )
            }

            // One cached pass, two draws: a single horizontal gradient combining the
            // left legibility ramp (solid page-bg across the metadata column, then a
            // long fade out) with the brand tint fading in on the right, plus the
            // hoisted top/bottom vertical fade. No per-layer composable nodes.
            Box(
                Modifier.fillMaxSize().drawWithCache {
                    val hFade = Brush.horizontalGradient(
                        0.0f to PageBg,
                        0.34f to PageBg,
                        0.58f to PageBg.copy(alpha = 0.55f),
                        0.72f to Color.Transparent,
                        1.0f to brand.copy(alpha = 0.30f),
                    )
                    onDrawBehind {
                        drawRect(hFade)
                        drawRect(VFade)
                    }
                },
            )

            // ── meta block (left) ──
            Column(
                Modifier
                    .align(Alignment.CenterStart)
                    .offset(y = (-18).dp)
                    .fillMaxWidth(0.66f)
                    .padding(start = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                // Provider logo SVG (bundled asset) or text fallback
                if (section.logoAsset != null) {
                    AsyncImage(
                        model = section.logoAsset,
                        contentDescription = section.label,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.height(24.dp).width(120.dp),
                        colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(Color.White),
                    )
                } else {
                    Text(
                        text = section.label.uppercase(),
                        color = Color.White,
                        fontFamily = ChesnaGrotesk,
                        fontWeight = FontWeight.Light,
                        fontSize = 22.sp,
                        letterSpacing = 4.sp,
                    )
                }

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

                // Year (pill) first, then HD · ★rating · 🍅rt% — one row.
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
                                .clip(ChipShape)
                                .background(Color(0x1FFFFFFF))
                                .border(1.dp, Color(0x33FFFFFF), ChipShape)
                                .padding(horizontal = 9.dp, vertical = 3.dp),
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
        // A plain Row + horizontalScroll, NOT a LazyRow: each section holds only
        // ~10 cards (HomeRepository.CAROUSEL_SIZE), so the lazy machinery buys
        // nothing and a nested LazyRow is a SubcomposeLayout with real per-instance
        // overhead. The home feed is composed once inside a Column + verticalScroll
        // (see HomeScreen), so these ten tiny cards just compose eagerly alongside
        // the rest of the section — cheaper than spinning up a lazy layout.
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, bottom = 8.dp),
        ) {
            for (card in section.cards) {
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
    Box(
        Modifier
            .height(32.dp)
            .focusHighlight(ChipShape)
            .clip(ChipShape)
            .then(
                if (primary) Modifier.background(Color.White)
                else Modifier.background(Color(0x1AFFFFFF)).border(1.dp, Color(0x33FFFFFF), ChipShape),
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
