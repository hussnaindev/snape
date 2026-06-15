package com.snape.flix.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
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
    val listState = rememberLazyListState()
    val heroPlaying by remember { derivedStateOf { listState.firstVisibleItemIndex == 0 } }

    fun openCard(card: HomeCard) {
        val subject = card.subject
        if (subject != null) onOpenDetail(SubjectGroup(subject, listOf(subject)))
        else viewModel.resolveAndOpen(card.title, onOpenDetail)
    }

    Box(modifier.fillMaxSize().background(PageBg)) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
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

            else -> LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
            ) {
                item {
                    HeroCarousel(
                        onOpenTitle = { title, isSeries -> viewModel.resolveAndOpen(title, onOpenDetail) },
                        playbackEnabled = heroPlaying && !resolving,
                    )
                }

                // Continue Watching row — built but hidden until local watch
                // history exists (recording deferred). Renders nothing for now.
                item { ContinueWatchingRow(entries = emptyList(), onOpen = {}) }

                items(state.sections, key = { it.key }, contentType = { "section" }) { section ->
                    ProviderSection(
                        section = section,
                        onOpenCard = ::openCard,
                        onExplore = { /* browse-by-provider not yet wired */ },
                    )
                }

                item { HomeBanner(onLogin = {}, onSignUp = {}, modifier = Modifier.navigationBarsPadding()) }
            }
        }

        if (resolving) {
            Box(
                Modifier.fillMaxSize().background(Color(0x66000000)),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
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
