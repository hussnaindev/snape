package com.snape.flix.ui.watchlist

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
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.snape.flix.data.LocalStore
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.components.PosterCard
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)

/**
 * The watchlist page — every saved title in one un-categorised grid (the pill/chip
 * on each card already conveys film vs. series, so no separate tabs). Uses the
 * standard poster card in watchlist mode: the rating chip is swapped for a filled
 * watchlist icon that removes the title on tap. Same lined heading + back chip as
 * the browse pages.
 */
@Composable
fun WatchlistScreen(
    onOpenDetail: (SubjectGroup) -> Unit,
    onBack: () -> Unit,
) {
    val items by LocalStore.watchlist.collectAsStateWithLifecycle()

    Box(Modifier.fillMaxSize().background(PageBg)) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth()) {
                BackChip(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(top = 16.dp, bottom = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    LinedHeading("Watchlist", modifier = Modifier.padding(horizontal = 56.dp))
                }
            }

            if (items.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "Your watchlist is empty.\nTap the + on any title to save it.",
                        color = Color(0x80FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(32.dp),
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(items, key = { it.subjectId }) { item ->
                        PosterCard(
                            posterUrl = item.posterUrl,
                            isSeries = item.isSeries,
                            rating = item.rating?.takeIf { it > 0 },
                            title = item.cleanTitle,
                            onClick = { onOpenDetail(SubjectGroup(item, listOf(item))) },
                            onWatchlistRemove = { LocalStore.removeFromWatchlist(item.subjectId) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}
