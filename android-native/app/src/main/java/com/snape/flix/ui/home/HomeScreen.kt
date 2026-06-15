package com.snape.flix.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.snape.flix.data.HistoryEntry
import com.snape.flix.data.HomeCard
import com.snape.flix.data.LocalStore
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.components.PosterCard
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)

/**
 * The native home screen — a pixel replica of the web mobile home: hero carousel,
 * (deferred) Continue Watching row, the eight curated provider sections, then the
 * footer banner. Catalogue data is MovieBox-first with TMDB fallback/enrichment
 * (see [HomeRepository]).
 */
@Composable
fun HomeScreen(
    onOpenDetail: (SubjectGroup) -> Unit,
    onExplore: (HomeSection) -> Unit,
    onOpenContinue: (HistoryEntry) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val resolving by viewModel.resolving.collectAsStateWithLifecycle()
    val history by LocalStore.history.collectAsStateWithLifecycle()
    val continueWatching = remember(history) { LocalStore.continueWatching() }
    // A plain vertical scroll, NOT a LazyColumn. The feed is bounded (hero + 8
    // sections + banner), so we don't need virtualization — and virtualization is
    // exactly what caused the fling jank: a LazyColumn re-composes each heavy
    // section as it scrolls into view, on the fling's critical frames. A Column +
    // verticalScroll composes all children once, then scrolling is pure layer
    // translation (like the web home's compositor scroll) with no re-composition.
    val scrollState = rememberScrollState()
    val heroPlaying by remember { derivedStateOf { scrollState.value < 600 } }
    val scrolling by remember { derivedStateOf { scrollState.isScrollInProgress } }

    fun openCard(card: HomeCard) {
        val subject = card.subject
        if (subject != null) onOpenDetail(SubjectGroup(subject, listOf(subject)))
        else viewModel.resolveAndOpen(card.title, onOpenDetail)
    }

    Box(modifier.fillMaxSize().background(PageBg)) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                SnakeLoader(size = 56.dp)
            }

            state.error != null && state.sections.isEmpty() -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    state.error ?: "Failed to load",
                    color = Color(0x80FFFFFF),
                    fontFamily = ChesnaGrotesk,
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(32.dp),
                )
            }

            else -> Column(
                modifier = Modifier.fillMaxSize().verticalScroll(scrollState),
            ) {
                HeroCarousel(
                    onOpenTitle = { title, isSeries -> viewModel.resolveAndOpen(title, onOpenDetail) },
                    playbackEnabled = heroPlaying && !resolving,
                    scrolling = scrolling,
                )

                // Continue Watching row — populated from the on-device history.
                ContinueWatchingRow(entries = continueWatching, onOpen = onOpenContinue)

                for (section in state.sections) {
                    ProviderSection(
                        section = section,
                        onOpenCard = ::openCard,
                        onExplore = { onExplore(section) },
                    )
                }

                HomeBanner(modifier = Modifier.navigationBarsPadding())
            }
        }

        if (resolving) {
            Box(
                Modifier.fillMaxSize().background(Color(0x66000000)),
                contentAlignment = Alignment.Center,
            ) {
                SnakeLoader(size = 56.dp)
            }
        }
    }
}

/**
 * Continue Watching row (web `ContinueWatchingCarousel`). Renders the in-progress
 * titles from the on-device history, newest first, each with a resume progress bar.
 * Tapping a card reopens detail and resumes at the saved position.
 */
@Composable
private fun ContinueWatchingRow(entries: List<HistoryEntry>, onOpen: (HistoryEntry) -> Unit) {
    if (entries.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 16.dp)) {
        Text(
            "CONTINUE WATCHING",
            color = Color.White,
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            letterSpacing = 2.sp,
            modifier = Modifier.padding(start = 20.dp, bottom = 12.dp),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
        ) {
            for (entry in entries) {
                val item = entry.item
                PosterCard(
                    posterUrl = item.posterUrl,
                    isSeries = item.isSeries,
                    rating = item.rating?.takeIf { it > 0 },
                    title = item.cleanTitle,
                    onClick = { onOpen(entry) },
                    progress = entry.fraction,
                    modifier = Modifier.width(130.dp),
                )
            }
        }
    }
}
