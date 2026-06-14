package com.snape.flix.ui.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.snape.flix.R
import com.snape.flix.data.SubjectItem
import com.snape.flix.ui.components.MediaCard

@Composable
fun SearchScreen(
    onPlay: (item: SubjectItem, se: Int, ep: Int) -> Unit,
    viewModel: SearchViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val picker by viewModel.picker.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .statusBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        Header()
        Spacer(Modifier.height(14.dp))
        SearchBar(
            loading = state.loading,
            onSearch = viewModel::search,
        )
        Spacer(Modifier.height(16.dp))

        when {
            state.error != null -> CenterNote(state.error!!)
            !state.searched -> CenterNote("Search for any movie or series.")
            state.results.isEmpty() && !state.loading -> CenterNote("No results for “${state.query}”.")
            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(110.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 24.dp),
                modifier = Modifier.weight(1f).fillMaxWidth(),
            ) {
                items(
                    items = state.results,
                    key = { it.subjectId + it.corner },
                    contentType = { "card" },
                ) { item ->
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

    EpisodePickerSheet(
        state = picker,
        onDismiss = viewModel::closePicker,
        onPlay = { item, se, ep ->
            viewModel.closePicker()
            onPlay(item, se, ep)
        },
    )
}

@Composable
private fun Header() {
    Row(
        Modifier.fillMaxWidth().padding(top = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(R.drawable.snape_logo),
            contentDescription = null,
            modifier = Modifier.size(26.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = "SNAPE",
            color = Color.White,
            fontSize = 20.sp,
            letterSpacing = 6.sp,
            style = MaterialTheme.typography.titleLarge,
        )
    }
}

@Composable
private fun SearchBar(loading: Boolean, onSearch: (String) -> Unit) {
    // Local text state keeps keystrokes from recomposing the results grid.
    var query by remember { mutableStateOf("") }

    TextField(
        value = query,
        onValueChange = { query = it; onSearch(it) },
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
                        .clickable { query = ""; onSearch("") },
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

