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
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.snape.flix.R
import com.snape.flix.data.SubjectItem
import com.snape.flix.ui.components.MediaCard
import com.snape.flix.ui.theme.ChesnaGrotesk

@Composable
fun SearchScreen(
    onPlay: (item: SubjectItem, se: Int, ep: Int) -> Unit,
    viewModel: SearchViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val picker by viewModel.picker.collectAsStateWithLifecycle()

    // Search field shows by default (this is the search screen); the magnifier in
    // the bar collapses it. Drawer mirrors the web's right-side mobile menu.
    var searchOpen by remember { mutableStateOf(true) }
    var drawerOpen by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(horizontal = 16.dp),
        ) {
            TopBar(
                searchOpen = searchOpen,
                onToggleSearch = {
                    searchOpen = !searchOpen
                    if (!searchOpen) viewModel.onQueryChange("")
                },
                onOpenMenu = { drawerOpen = true },
            )

            if (searchOpen) {
                Spacer(Modifier.height(12.dp))
                SearchBar(
                    query = state.query,
                    loading = state.loading,
                    onQueryChange = viewModel::onQueryChange,
                )
            }

            Spacer(Modifier.height(16.dp))

            when {
                state.error != null -> CenterNote(state.error!!)
                !state.searched -> CenterNote("Search for any movie or series.")
                state.results.isEmpty() && !state.loading -> CenterNote("No results for “${state.query}”.")
                else -> LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(state.results, key = { it.subjectId + it.corner }) { item ->
                        MediaCard(
                            item = item,
                            onClick = {
                                if (item.isSeries) viewModel.openSeries(item) else onPlay(item, 0, 0)
                            },
                        )
                    }
                }
            }
        }

        if (drawerOpen) {
            SideDrawer(onClose = { drawerOpen = false })
        }
    }

    EpisodePickerSheet(
        state = picker,
        onDismiss = viewModel::closePicker,
        onPlay = { item, se, ep ->
            viewModel.closePicker()
            onPlay(item, se, ep)
        },
    )
}

// ── top bar ──────────────────────────────────────────────────────────────────

@Composable
private fun TopBar(searchOpen: Boolean, onToggleSearch: () -> Unit, onOpenMenu: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(R.drawable.snape_logo),
            contentDescription = "Snape",
            modifier = Modifier.size(24.dp),
        )
        Spacer(Modifier.weight(1f))
        BarIcon(
            icon = if (searchOpen) Icons.Rounded.Close else Icons.Rounded.Search,
            desc = if (searchOpen) "Close search" else "Search",
            onClick = onToggleSearch,
        )
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

@Composable
private fun SearchBar(query: String, loading: Boolean, onQueryChange: (String) -> Unit) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        singleLine = true,
        placeholder = { Text("Search movies & series", color = Color(0x66FFFFFF)) },
        leadingIcon = {
            if (loading) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Icon(Icons.Rounded.Search, contentDescription = null, tint = Color(0x99FFFFFF))
            }
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                Icon(
                    Icons.Rounded.Close,
                    contentDescription = "Clear",
                    tint = Color(0x99FFFFFF),
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .size(20.dp)
                        .clickable { onQueryChange("") },
                )
            }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        shape = RoundedCornerShape(50),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Color(0x14FFFFFF),
            unfocusedContainerColor = Color(0x14FFFFFF),
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = Color.White,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(50)),
    )
}

// ── side drawer (mirrors the web mobile menu; links wired up later) ───────────

private data class MenuItem(val label: String, val danger: Boolean = false)
private data class MenuSection(val title: String, val items: List<MenuItem>)

private val GENRES = listOf(
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Drama", "Family",
    "Fantasy", "History", "Horror", "Romance", "Sci-Fi", "Thriller",
)

private val MENU_SECTIONS = listOf(
    MenuSection("Streaming", listOf(MenuItem("Streaming Providers"))),
    MenuSection("Browse", GENRES.map { MenuItem(it) }),
    MenuSection("Continue watching", listOf(MenuItem("Clear watch history"))),
    MenuSection(
        "Account",
        listOf(
            MenuItem("Downloads"),
            MenuItem("Profile"),
            MenuItem("My Watchlist"),
            MenuItem("Settings"),
            MenuItem("Sign out", danger = true),
        ),
    ),
)

@Composable
private fun SideDrawer(onClose: () -> Unit) {
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
                .fillMaxWidth(0.85f)
                .widthIn(max = 320.dp)
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
                    Text("Menu", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("Browse & account", color = Color(0x66FFFFFF), fontSize = 12.sp)
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
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 20.dp, end = 16.dp, top = 14.dp, bottom = 8.dp),
                    )
                    section.items.forEach { item -> DrawerRow(item, onClose) }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun DrawerRow(item: MenuItem, onClose: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClose) // links wired up later
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = item.label,
            color = if (item.danger) Color(0xFFF87171) else Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontSize = 12.sp,
            letterSpacing = 2.sp,
            modifier = Modifier.weight(1f),
        )
        if (!item.danger) {
            Icon(
                Icons.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = Color(0x59FFFFFF),
                modifier = Modifier.size(18.dp),
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
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(32.dp),
        )
    }
}
