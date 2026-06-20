package com.snape.flix.ui.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import com.snape.flix.R
import com.snape.flix.data.DownloadStatus
import com.snape.flix.data.Downloads
import com.snape.flix.data.LocalStore
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.browse.BrowseActivity
import com.snape.flix.ui.components.DownloadGlyph
import com.snape.flix.ui.streaming.StreamingSitesActivity
import com.snape.flix.ui.components.MediaCard
import com.snape.flix.ui.components.ProgressRing
import com.snape.flix.ui.components.PullToRefresh
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.downloads.DownloadsActivity
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.home.HomeScreen
import com.snape.flix.ui.theme.ChesnaGrotesk
import com.snape.flix.ui.watchlist.WatchlistActivity

@Composable
fun SearchScreen(
    onOpenDetail: (group: SubjectGroup) -> Unit,
    viewModel: SearchViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Home shows by default; the magnifier opens the search bar, and as soon as
    // the user types, the body crossfades to the results grid. Drawer mirrors the
    // web's right-side mobile menu.
    var searchOpen by remember { mutableStateOf(false) }
    var drawerOpen by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        // Body fills from the very top: in home mode the hero sits behind the
        // transparent status bar and the floating top bar (like the detail hero).
        // Tapping the magnifier opens the search screen immediately (empty prompt
        // until the user types); closing the bar returns to the home screen.
        Crossfade(
            targetState = searchOpen,
            modifier = Modifier.fillMaxSize(),
            label = "homeSearch",
        ) { searching ->
            if (!searching) {
                HomeScreen(
                    onOpenDetail = onOpenDetail,
                    onExplore = { section ->
                        // Explore = MovieBox keyword search for the section label.
                        BrowseActivity.start(context, section.label, section.label)
                    },
                    onOpenContinue = { entry ->
                        DetailActivity.start(
                            context,
                            SubjectGroup(entry.item, listOf(entry.item)),
                            resumeSe = entry.se,
                            resumeEp = entry.ep,
                        )
                    },
                )
            } else {
                Column(
                    Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(top = 56.dp, start = 16.dp, end = 16.dp),
                ) {
                    SearchResults(
                        state = state,
                        refreshing = refreshing,
                        onRefresh = viewModel::refresh,
                        onLoadMore = viewModel::loadMore,
                        onOpenDetail = onOpenDetail,
                    )
                }
            }
        }

        // Floating top bar — overlays the hero, sitting below the status bar.
        TopBar(
            searchOpen = searchOpen,
            query = state.query,
            loading = state.loading,
            onToggleSearch = {
                searchOpen = !searchOpen
                if (!searchOpen) viewModel.onQueryChange("")
            },
            onQueryChange = viewModel::onQueryChange,
            onOpenMenu = { drawerOpen = true },
            modifier = Modifier.statusBarsPadding().padding(horizontal = 16.dp),
        )

        if (drawerOpen) {
            SideDrawer(
                onClose = { drawerOpen = false },
                onOpenGenre = { genre -> BrowseActivity.start(context, genre, genre) },
                onOpenWatchlist = { WatchlistActivity.start(context) },
                onOpenDownloads = { DownloadsActivity.start(context) },
                onClearHistory = { LocalStore.clearHistory() },
                onOpenStreaming = { StreamingSitesActivity.start(context) },
            )
        }
    }
}

@Composable
private fun SearchResults(
    state: SearchUiState,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onOpenDetail: (group: SubjectGroup) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxSize()) {
        when {
            state.query.isBlank() -> CenterNote("Search for any movie or series.")
            state.error != null -> CenterNote(state.error!!)
            state.results.isEmpty() && state.loading -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                SnakeLoader(size = 48.dp)
            }
            state.results.isEmpty() && !state.loading && state.searched ->
                CenterNote("No results for “${state.query}”.")
            else -> {
                val gridState = rememberLazyGridState()

                // Infinite scroll: when the last few cards come into view and
                // more pages remain, fetch the next page.
                val shouldLoadMore by remember {
                    derivedStateOf {
                        val last = gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                        last >= state.results.size - 4
                    }
                }
                LaunchedEffect(shouldLoadMore, state.canLoadMore) {
                    if (shouldLoadMore && state.canLoadMore) onLoadMore()
                }

                PullToRefresh(
                    isRefreshing = refreshing,
                    onRefresh = onRefresh,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    LazyVerticalGrid(
                        state = gridState,
                        columns = GridCells.Fixed(2),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(state.results, key = { it.primary.subjectId }) { group ->
                            MediaCard(
                                item = group.primary,
                                onClick = { onOpenDetail(group) },
                            )
                        }
                        if (state.loadingMore) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Box(
                                    Modifier.fillMaxWidth().padding(vertical = 20.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    SnakeLoader(size = 40.dp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── top bar ──────────────────────────────────────────────────────────────────

@Composable
private fun TopBar(
    searchOpen: Boolean,
    query: String,
    loading: Boolean,
    onToggleSearch: () -> Unit,
    onQueryChange: (String) -> Unit,
    onOpenMenu: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier.fillMaxWidth().height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(R.drawable.snape_logo),
            contentDescription = "Snape",
            modifier = Modifier.size(24.dp),
        )
        // The search bar lives here and unfurls leftward from the search icon —
        // it grows from the End edge, so it appears to slide out of the magnifier.
        Box(
            Modifier.weight(1f).padding(start = 12.dp),
            contentAlignment = Alignment.CenterEnd,
        ) {
            ExpandingSearchBar(
                visible = searchOpen,
                query = query,
                loading = loading,
                onQueryChange = onQueryChange,
                onClose = onToggleSearch,
            )
        }
        // When the bar is closed only the magnifier shows; tapping it reveals the bar.
        if (!searchOpen) {
            BarIcon(icon = Icons.Rounded.Search, desc = "Search", onClick = onToggleSearch)
        }
        // Download indicator — only present while one or more downloads are in flight.
        DownloadIndicator()
        Spacer(Modifier.width(4.dp))
        // Hamburger sits in a rounded chip, like the web's mobile menu button.
        Box(
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0x0DFFFFFF))
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                .clickable(onClick = onOpenMenu),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Menu, "Open menu", tint = Color(0xCCFFFFFF), modifier = Modifier.size(20.dp))
        }
    }
}

/**
 * Home top-bar download status button. Hidden entirely when nothing is
 * downloading; otherwise a circular green-gradient progress ring (averaged across
 * the in-flight downloads) wraps the download icon, with a count badge in the
 * top-right when more than one download is active. Opens the downloads page.
 */
@Composable
private fun DownloadIndicator() {
    val items by Downloads.items.collectAsStateWithLifecycle()
    val active = items.filter { it.inProgress }
    if (active.isEmpty()) return
    val context = LocalContext.current
    val running = active.filter { it.status == DownloadStatus.RUNNING }
    val progressItems = if (running.isNotEmpty()) running else active
    val avg = progressItems.map { it.fraction }.average().toFloat()

    Box(
        Modifier
            .size(40.dp)
            .clip(CircleShape)
            .clickable { DownloadsActivity.start(context) },
        contentAlignment = Alignment.Center,
    ) {
        ProgressRing(progress = avg, modifier = Modifier.size(36.dp), strokeWidth = 2.5.dp)
        DownloadGlyph(modifier = Modifier.size(18.dp), tint = Color(0xCCFFFFFF))
        if (active.size > 1) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF059669)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    active.size.toString(),
                    color = Color.White,
                    fontFamily = ChesnaGrotesk,
                    fontWeight = FontWeight.Bold,
                    fontSize = 9.sp,
                )
            }
        }
    }
}

@Composable
private fun BarIcon(icon: ImageVector, desc: String, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(50)).clickable(onClick = onClick).padding(8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, desc, tint = Color(0xB3FFFFFF), modifier = Modifier.size(22.dp))
    }
}

// ── search field ─────────────────────────────────────────────────────────────

/**
 * The search field that unfurls leftward out of the topbar magnifier. Kept in
 * its own composable (no Row/Column receiver in scope) so `AnimatedVisibility`
 * resolves to the plain overload rather than the `RowScope` extension.
 */
@Composable
private fun ExpandingSearchBar(
    visible: Boolean,
    query: String,
    loading: Boolean,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
) {
    AnimatedVisibility(
        visible = visible,
        enter = expandHorizontally(expandFrom = Alignment.End) + fadeIn(),
        exit = shrinkHorizontally(shrinkTowards = Alignment.End) + fadeOut(),
    ) {
        SearchBar(
            query = query,
            loading = loading,
            onQueryChange = onQueryChange,
            onClose = onClose,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun SearchBar(
    query: String,
    loading: Boolean,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pill = RoundedCornerShape(50)
    BasicTextField(
        value = query,
        onValueChange = onQueryChange,
        singleLine = true,
        cursorBrush = SolidColor(Color.White),
        textStyle = TextStyle(
            color = Color.White,
            fontFamily = ChesnaGrotesk,
            fontSize = 13.sp,
            letterSpacing = 0.4.sp,
            // Without this the glyph box carries extra top padding, so the caret
            // and typed text sit above the placeholder. Dropping it centers them.
            platformStyle = PlatformTextStyle(includeFontPadding = false),
        ),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        modifier = modifier
            .height(40.dp)
            .clip(pill)
            .background(Color(0x14FFFFFF))
            .border(1.dp, Color(0x26FFFFFF), pill),
        decorationBox = { inner ->
            Row(
                Modifier.fillMaxWidth().padding(start = 14.dp, end = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Leading: search magnifier (or the live loading spinner).
                if (loading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(15.dp),
                    )
                } else {
                    Icon(
                        Icons.Rounded.Search,
                        contentDescription = null,
                        tint = Color(0x99FFFFFF),
                        modifier = Modifier.size(17.dp),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) {
                        Text(
                            "Search for any movie or series",
                            color = Color(0x66FFFFFF),
                            fontFamily = ChesnaGrotesk,
                            fontSize = 13.sp,
                            letterSpacing = 0.4.sp,
                            maxLines = 1,
                            style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
                        )
                    }
                    inner()
                }
                Spacer(Modifier.width(6.dp))
                // Trailing: close (✕) — collapses the bar and clears the query.
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(50))
                        .clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Rounded.Close,
                        contentDescription = "Close search",
                        tint = Color(0x99FFFFFF),
                        modifier = Modifier.size(17.dp),
                    )
                }
            }
        },
    )
}

// ── side drawer (mirrors the web mobile menu; links wired up later) ───────────

/** A drawer link. [kind] decides what tapping it does (see [SideDrawer]). */
private enum class MenuKind { GENRE, WATCHLIST, DOWNLOADS, CLEAR_HISTORY, STREAMING, NONE }
private data class MenuItem(val label: String, val kind: MenuKind = MenuKind.NONE, val danger: Boolean = false)
private data class MenuSection(val title: String, val items: List<MenuItem>)

private val GENRES = listOf(
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Drama", "Family",
    "Fantasy", "History", "Horror", "Romance", "Sci-Fi", "Thriller",
)

// No-signup app: the menu carries no login/sign-out/account links.
private val MENU_SECTIONS = listOf(
    MenuSection("Streaming", listOf(MenuItem("Streaming Sites", MenuKind.STREAMING))),
    MenuSection("Browse", GENRES.map { MenuItem(it, MenuKind.GENRE) }),
    MenuSection("Continue watching", listOf(MenuItem("Clear watch history", MenuKind.CLEAR_HISTORY))),
    MenuSection(
        "Library",
        listOf(
            MenuItem("My Watchlist", MenuKind.WATCHLIST),
            MenuItem("Downloads", MenuKind.DOWNLOADS),
        ),
    ),
)

@Composable
private fun SideDrawer(
    onClose: () -> Unit,
    onOpenGenre: (String) -> Unit,
    onOpenWatchlist: () -> Unit,
    onOpenDownloads: () -> Unit,
    onClearHistory: () -> Unit,
    onOpenStreaming: () -> Unit,
) {
    Box(Modifier.fillMaxSize()) {
        // scrim
        Box(
            Modifier
                .fillMaxSize()
                .background(Color(0xB3000000))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onClose,
                ),
        )
        // panel
        Column(
            Modifier
                .align(Alignment.CenterEnd)
                .fillMaxHeight()
                .fillMaxWidth(0.55f)
                .widthIn(max = 220.dp)
                .background(Color(0xFF0F0F10))
                .border(1.dp, Color(0x1AFFFFFF))
                // swallow taps so they don't reach the scrim
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                ) {},
        ) {
            // header
            Row(
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(start = 20.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x0DFFFFFF))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        painter = painterResource(R.drawable.snape_logo),
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Menu", color = Color.White, fontFamily = ChesnaGrotesk, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("Browse & account", color = Color(0x66FFFFFF), fontFamily = ChesnaGrotesk, fontSize = 12.sp)
                }
                Box(
                    Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x0DFFFFFF))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                        .clickable(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Close, "Close menu", tint = Color(0x99FFFFFF), modifier = Modifier.size(18.dp))
                }
            }

            Column(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                MENU_SECTIONS.forEach { section ->
                    // thin divider above each section, like the web menu's border-t
                    Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x14FFFFFF)))
                    Text(
                        text = section.title.uppercase(),
                        color = Color(0x66FFFFFF),
                        fontFamily = ChesnaGrotesk,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 20.dp, end = 16.dp, top = 14.dp, bottom = 8.dp),
                    )
                    section.items.forEach { item ->
                        DrawerRow(item) {
                            when (item.kind) {
                                MenuKind.GENRE -> onOpenGenre(item.label)
                                MenuKind.WATCHLIST -> onOpenWatchlist()
                                MenuKind.DOWNLOADS -> onOpenDownloads()
                                MenuKind.CLEAR_HISTORY -> onClearHistory()
                                MenuKind.STREAMING -> onOpenStreaming()
                                MenuKind.NONE -> Unit
                            }
                            onClose()
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun DrawerRow(item: MenuItem, onClick: () -> Unit) {
    // Label hugs the left edge, chevron the right — space-between across the
    // (now narrower) panel. Font sizing trimmed to fit the reduced width.
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = item.label,
            color = if (item.danger) Color(0xFFF87171) else Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 11.5.sp,
            letterSpacing = 0.8.sp,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (!item.danger) {
            Icon(
                Icons.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = Color(0x59FFFFFF),
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun CenterNote(text: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            text = text,
            color = Color(0x80FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 13.sp,
            letterSpacing = 0.4.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(32.dp),
        )
    }
}
