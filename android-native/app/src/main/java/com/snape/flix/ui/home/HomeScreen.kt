package com.snape.flix.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.snape.flix.data.HomeCard
import com.snape.flix.data.SubjectGroup
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
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val resolving by viewModel.resolving.collectAsStateWithLifecycle()
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

                // Continue Watching row — built but hidden until local watch
                // history exists (recording deferred). Renders nothing for now.
                ContinueWatchingRow(entries = emptyList(), onOpen = {})

                for (section in state.sections) {
                    ProviderSection(
                        section = section,
                        onOpenCard = ::openCard,
                        onExplore = { /* browse-by-provider not yet wired */ },
                    )
                }

                HomeBanner(onLogin = {}, onSignUp = {}, modifier = Modifier.navigationBarsPadding())
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
 * Continue Watching row (web `ContinueWatchingCarousel`). Watch-history recording
 * isn't wired natively yet, so this renders nothing while [entries] is empty —
 * the layout is in place for when local history lands.
 */
@Composable
private fun ContinueWatchingRow(entries: List<HomeCard>, onOpen: (HomeCard) -> Unit) {
    if (entries.isEmpty()) return
    // (Intentionally empty for now — populated once native history is recorded.)
}
