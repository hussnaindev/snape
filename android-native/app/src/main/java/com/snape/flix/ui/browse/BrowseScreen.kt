package com.snape.flix.ui.browse

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.snape.flix.data.AdultRepository
import com.snape.flix.data.SubjectGroup
import com.snape.flix.data.SubjectItem
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.components.MediaCard
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.search.SearchViewModel
import com.snape.flix.ui.theme.ChesnaGrotesk

private val PageBg = Color(0xFF070B08)
private val CardShape = RoundedCornerShape(16.dp)
private val CardSurface = Color(0x0DFFFFFF)
private val CardRing = Color(0x40FFFFFF)
private val ChipBg = Color(0x99000000)
private val ChipBorder = Color(0x66FFFFFF)
private val ChipShape = RoundedCornerShape(50)

private sealed interface AdultState {
    data object Loading : AdultState
    data class Loaded(val groups: List<SubjectGroup>) : AdultState
    data class Error(val message: String) : AdultState
}

@Composable
fun BrowseScreen(
    title: String,
    query: String,
    onOpenDetail: (SubjectGroup) -> Unit,
    onBack: () -> Unit,
    vm: SearchViewModel = viewModel(),
) {
    val isAdult = query == "Adult"
    val context = LocalContext.current
    val adultState = remember { mutableStateOf<AdultState>(AdultState.Loading) }

    if (isAdult) {
        LaunchedEffect(Unit) {
            adultState.value = try {
                AdultState.Loaded(AdultRepository.loadGroups(context))
            } catch (e: Exception) {
                AdultState.Error(e.message ?: "Failed to load adult data")
            }
        }
    }

    LaunchedEffect(query) { if (!isAdult) vm.onQueryChange(query) }
    val state by vm.state.collectAsStateWithLifecycle()

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

            if (isAdult) {
                AdultContent(adultState = adultState.value, onOpenDetail = onOpenDetail)
            } else {
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
                            items(state.results, key = { it.primary.subjectId }) { group ->
                                MediaCard(item = group.primary, onClick = { onOpenDetail(group) })
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
}

@Composable
private fun AdultContent(
    adultState: AdultState,
    onOpenDetail: (SubjectGroup) -> Unit,
) {
    when (adultState) {
        is AdultState.Loading -> Box(
            Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) { SnakeLoader(size = 48.dp) }

        is AdultState.Error -> Box(
            Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                adultState.message,
                color = Color(0x80FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(32.dp),
            )
        }

        is AdultState.Loaded -> {
            val listState = rememberLazyListState()
            LazyColumn(
                state = listState,
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                items(adultState.groups, key = { it.primary.subjectId }) { group ->
                    val studio = group.primary.title.trim().split(Regex("\\s+")).firstOrNull()?.uppercase() ?: ""
                    LandscapeCard(
                        item = group.primary,
                        chipText = studio,
                        onClick = { onOpenDetail(group) },
                    )
                }
            }
        }
    }
}

@Composable
private fun LandscapeCard(
    item: SubjectItem,
    chipText: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(CardSurface)
            .border(1.dp, CardRing, CardShape)
            .clickable(onClick = onClick)
            .height(200.dp),
    ) {
        if (item.cover != null) {
            AsyncImage(
                model = item.cover.url,
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

        Box(
            Modifier
                .fillMaxWidth()
                .height(160.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        0f to Color(0x00000000),
                        0.5f to Color(0x99000000),
                        1f to Color(0xE6000000),
                    )
                ),
        )

        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp)
                .clip(ChipShape)
                .background(ChipBg)
                .border(0.5.dp, ChipBorder, ChipShape)
                .padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Text(
                text = chipText,
                color = Color.White,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(horizontal = 12.dp, vertical = 12.dp),
        ) {
            Text(
                text = item.title.uppercase(),
                color = Color.White,
                fontFamily = ChesnaGrotesk,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (item.description.isNotBlank()) {
                Text(
                    text = item.description,
                    color = Color(0xB3FFFFFF),
                    fontFamily = ChesnaGrotesk,
                    fontSize = 11.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}
