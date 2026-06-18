package com.snape.flix.ui.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.snape.flix.data.TmdbRepository
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.components.PosterCard
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)

@Composable
fun ProviderBrowseScreen(
    title: String,
    providerId: Int,
    onOpenDetail: (HomeCard) -> Unit,
    onBack: () -> Unit,
    vm: ProviderBrowseViewModel = viewModel(),
) {
    LaunchedEffect(providerId) { vm.start(providerId) }
    val state by vm.state.collectAsStateWithLifecycle()

    // Interleave movies & series, de-duped by (mediaType, tmdbId) so the LazyGrid
    // never sees a repeated key (a movie and a series can share a title, and TMDB
    // can repeat an item across pages — either would crash the grid otherwise).
    val allResults = remember(state.movies, state.series) {
        val seen = HashSet<String>()
        buildList {
            (state.movies.map { it.toHomeCard(isSeries = false) } +
                state.series.map { it.toHomeCard(isSeries = true) })
                .forEach { card ->
                    if (seen.add("${card.isSeries}-${card.tmdbId}")) add(card)
                }
        }
    }

    Box(Modifier.fillMaxSize().background(PageBg)) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth()) {
                BackChip(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(top = 16.dp, bottom = 20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    LinedHeading(title, modifier = Modifier.padding(horizontal = 56.dp))
                }
            }

            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    SnakeLoader(size = 48.dp)
                }

                allResults.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "No titles available for this provider.",
                        color = Color(0x80FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(32.dp),
                    )
                }

                else -> {
                    val gridState = rememberLazyGridState()
                    val shouldLoadMore by remember {
                        derivedStateOf {
                            val last = gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                            last >= allResults.size - 4
                        }
                    }
                    LaunchedEffect(shouldLoadMore) {
                        if (shouldLoadMore && state.hasMore) vm.loadMore()
                    }

                    LazyVerticalGrid(
                        state = gridState,
                        columns = GridCells.Fixed(2),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(allResults, key = { "${it.isSeries}-${it.tmdbId}" }) { card ->
                            PosterCard(
                                posterUrl = card.posterUrl,
                                isSeries = card.isSeries,
                                rating = card.rating,
                                title = card.title,
                                onClick = { onOpenDetail(card) },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        if (state.loadingMore) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Box(
                                    Modifier.fillMaxWidth().padding(vertical = 20.dp),
                                    contentAlignment = Alignment.Center,
                                ) { SnakeLoader(size = 40.dp) }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun TmdbSearchHit.toHomeCard(isSeries: Boolean) = HomeCard(
    title = displayTitle,
    posterUrl = TmdbRepository.img(poster_path, "w342"),
    rating = vote_average.takeIf { it > 0 },
    isSeries = isSeries,
    year = (if (isSeries) first_air_date else release_date).take(4),
    subject = null,
    tmdbId = id,
)
