package com.snape.flix.ui.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import com.snape.flix.data.TmdbRef
import com.snape.flix.data.TmdbRepository
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.components.PosterCard
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.search.SearchViewModel
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)

/**
 * Generic catalogue page shared by the provider "Explore" buttons and the genre
 * menu links. Both resolve to a MovieBox keyword search ([query]) rendered as the
 * same 2-column card grid the search screen uses, under a lined page heading with
 * a back chip — laid out identically so explore, genre and watchlist all match.
 */
@Composable
fun BrowseScreen(
    title: String,
    query: String,
    onOpenRef: (TmdbRef) -> Unit,
    onBack: () -> Unit,
    vm: SearchViewModel = viewModel(),
) {
    LaunchedEffect(query) { vm.onQueryChange(query) }
    val state by vm.state.collectAsStateWithLifecycle()

    Box(Modifier.fillMaxSize().background(PageBg)) {
        Column(Modifier.fillMaxSize()) {
            // header — back chip + lined title, below the transparent status bar.
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
                state.results.isEmpty() && state.loading -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) { SnakeLoader(size = 48.dp) }

                state.results.isEmpty() && (state.searched || state.error != null) -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        state.error ?: "Nothing here yet.",
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
                            last >= state.results.size - 4
                        }
                    }
                    LaunchedEffect(shouldLoadMore, state.canLoadMore) {
                        if (shouldLoadMore && state.canLoadMore) vm.loadMore()
                    }

                    LazyVerticalGrid(
                        state = gridState,
                        columns = GridCells.Fixed(2),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(state.results, key = { "${it.isSeries}-${it.id}" }) { hit ->
                            PosterCard(
                                posterUrl = TmdbRepository.img(hit.poster_path, "w342"),
                                isSeries = hit.isSeries,
                                rating = hit.vote_average.takeIf { it > 0 },
                                title = hit.displayTitle,
                                onClick = { onOpenRef(hit.toRef()) },
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
