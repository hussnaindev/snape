package com.snape.flix.ui.browse

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
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
import com.snape.flix.ui.components.PullToRefresh
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.search.SearchViewModel
import com.snape.flix.ui.theme.ChesnaGrotesk
import com.snape.flix.ui.tv.focusHighlight

private val PageBg = Color(0xFF070B08)
private val TitleScrim = Brush.verticalGradient(0f to Color(0x80000000), 1f to Color(0xD9000000))
private val Hairline = Color(0x1AFFFFFF)
private val ChipBg = Color(0x99000000)
private val ChipBorder = Color(0x66FFFFFF)
private val ChipShape = RoundedCornerShape(50)
private val CardSurface = Color(0x0DFFFFFF)

private sealed interface AdultState {
    data object Loading : AdultState
    data class Loaded(val groups: List<SubjectGroup>) : AdultState
    data class Error(val message: String) : AdultState
}

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
    val refreshing by vm.refreshing.collectAsStateWithLifecycle()

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
                val current = adultState.value
                if (current is AdultState.Loaded) {
                    val allGroups = current.groups
                    val studios = remember(allGroups) {
                        allGroups.map { it.primary.title.trim().split(Regex("\\s+")).first().uppercase() }.distinct().sorted()
                    }
                    val years = remember(allGroups) {
                        allGroups.map { it.primary.releaseDate.take(4) }.filter { it.isNotBlank() }.distinct().sortedDescending()
                    }

                    var selectedStudio by remember { mutableStateOf<String?>(null) }
                    var selectedYear by remember { mutableStateOf<String?>(null) }

                    val filtered = remember(allGroups, selectedStudio, selectedYear) {
                        allGroups.filter { g ->
                            val studio = g.primary.title.trim().split(Regex("\\s+")).first().uppercase()
                            val year = g.primary.releaseDate.take(4)
                            (selectedStudio == null || studio == selectedStudio) &&
                                (selectedYear == null || year == selectedYear)
                        }
                    }

                    Row(
                        Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(start = 16.dp, end = 16.dp, bottom = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        studios.forEach { s ->
                            FilterChip(
                                label = s,
                                selected = s == selectedStudio,
                                onClick = { selectedStudio = if (selectedStudio == s) null else s },
                            )
                        }
                        if (years.isNotEmpty()) {
                            Box(Modifier.width(1.dp).height(28.dp).background(Hairline).align(Alignment.CenterVertically))
                        }
                        years.forEach { y ->
                            FilterChip(
                                label = y,
                                selected = y == selectedYear,
                                onClick = { selectedYear = if (selectedYear == y) null else y },
                            )
                        }
                    }

                    if (selectedStudio != null || selectedYear != null) {
                        Text(
                            "${filtered.size} result${if (filtered.size != 1) "s" else ""}",
                            color = Color(0x66FFFFFF),
                            fontFamily = ChesnaGrotesk,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                        )
                    }

                    if (filtered.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "No matches",
                                color = Color(0x80FFFFFF),
                                fontFamily = ChesnaGrotesk,
                                fontSize = 13.sp,
                            )
                        }
                    } else {
                        val listState = rememberLazyListState()
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                        ) {
                            items(filtered, key = { it.primary.subjectId }) { group ->
                                AdultCard(item = group.primary, onClick = { onOpenDetail(group) })
                            }
                            item { Box(Modifier.height(24.dp)) }
                        }
                    }
                } else {
                    AdultContent(adultState = current)
                }
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

                        PullToRefresh(
                            isRefreshing = refreshing,
                            onRefresh = vm::refresh,
                            modifier = Modifier.fillMaxSize(),
                        ) {
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
}

@Composable
private fun AdultContent(adultState: AdultState) {
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

        is AdultState.Loaded -> Unit
    }
}

@Composable
private fun FilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val bg = if (selected) Color.White else Color(0x14FFFFFF)
    val textColor = if (selected) Color.Black else Color(0xB3FFFFFF)
    Box(
        Modifier
            .clip(ChipShape)
            .background(bg)
            .border(0.5.dp, if (selected) Color.Transparent else ChipBorder, ChipShape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            label,
            color = textColor,
            fontFamily = ChesnaGrotesk,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
            style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
        )
    }
}

@Composable
private fun AdultCard(
    item: SubjectItem,
    onClick: () -> Unit,
) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer { clip = true }
            .clickable(onClick = onClick)
            .height(200.dp),
    ) {
        if (item.cover != null) {
            AsyncImage(
                model = item.cover.url,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = 1.2f; scaleY = 1.2f },
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
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(TitleScrim)
                .padding(horizontal = 6.dp, vertical = 5.dp),
        ) {
            Text(
                text = item.cleanTitle.uppercase(),
                color = Color(0xE6FFFFFF),
                fontFamily = ChesnaGrotesk,
                fontSize = 9.sp,
                fontWeight = FontWeight.Light,
                letterSpacing = 1.2.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        StudioLogo(
            studio = item.title.trim().split(Regex("\\s+")).first().uppercase(),
            modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
        )

        item.rating?.takeIf { it > 0 }?.let { r ->
            Chip(
                text = "★ ${"%.1f".format(r)}",
                modifier = Modifier.align(Alignment.TopEnd).padding(5.dp),
            )
        }
    }

    Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline))
}

@Composable
private fun StudioLogo(studio: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val logoBitmap = remember(studio) {
        try {
            context.assets.open("${studio.lowercase()}-logo.png").use { stream ->
                BitmapFactory.decodeStream(stream)?.asImageBitmap()
            }
        } catch (_: Exception) { null }
    }
    if (logoBitmap != null) {
        Image(
            bitmap = logoBitmap,
            contentDescription = studio,
            modifier = modifier.width(80.dp).height(28.dp),
        )
    } else {
        Chip(text = "FILM", modifier = modifier)
    }
}

@Composable
private fun Chip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(ChipShape)
            .background(ChipBg)
            .border(0.5.dp, ChipBorder, ChipShape)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 8.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.3.sp,
            style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
        )
    }
}
