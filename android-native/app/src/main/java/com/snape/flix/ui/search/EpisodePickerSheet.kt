package com.snape.flix.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import com.snape.flix.ui.tv.focusHighlight
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.snape.flix.data.SeasonItem
import com.snape.flix.data.SubjectGroup

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EpisodePickerSheet(
    state: PickerState,
    onDismiss: () -> Unit,
    onPlay: (group: SubjectGroup, se: Int, ep: Int) -> Unit,
) {
    if (state is PickerState.Hidden) return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF0A0A0A),
        contentColor = Color.White,
    ) {
        when (state) {
            is PickerState.Hidden -> Unit
            is PickerState.Loading -> SheetMessage(state.group.primary.title, loading = true)
            is PickerState.Error -> SheetMessage("${state.group.primary.title}\n${state.message}", loading = false)
            is PickerState.Ready -> SeasonEpisodeChooser(
                group = state.group,
                seasons = state.seasons,
                onPlay = onPlay,
            )
        }
    }
}

@Composable
private fun SheetMessage(text: String, loading: Boolean) {
    Box(
        Modifier.fillMaxWidth().height(180.dp).padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (loading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
            Text(text, color = Color(0xB3FFFFFF), fontSize = 13.sp)
        }
    }
}

@Composable
private fun SeasonEpisodeChooser(
    group: SubjectGroup,
    seasons: List<SeasonItem>,
    onPlay: (SubjectGroup, Int, Int) -> Unit,
) {
    var selectedSeasonIdx by remember { mutableIntStateOf(0) }
    val season = seasons.getOrElse(selectedSeasonIdx) { seasons.first() }

    Column(Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
        Text(
            text = group.primary.title.uppercase(),
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Light,
            letterSpacing = 2.sp,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        Text(
            text = "Select an episode",
            color = Color(0x80FFFFFF),
            fontSize = 11.sp,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
        )

        if (seasons.size > 1) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(seasons) { s ->
                    val idx = seasons.indexOf(s)
                    val selected = idx == selectedSeasonIdx
                    Box(
                        Modifier
                            .focusHighlight(RoundedCornerShape(50))
                            .clip(RoundedCornerShape(50))
                            .background(if (selected) Color.White else Color(0x14FFFFFF))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(50))
                            .clickable { selectedSeasonIdx = idx }
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Text(
                            "SEASON ${s.se}",
                            color = if (selected) Color.Black else Color(0xCCFFFFFF),
                            fontSize = 11.sp,
                            letterSpacing = 1.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }

        LazyVerticalGrid(
            columns = GridCells.Adaptive(56.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth().height(280.dp),
        ) {
            items((1..season.maxEp).toList()) { ep ->
                Box(
                    Modifier
                        .size(56.dp)
                        .focusHighlight(CircleShape)
                        .clip(CircleShape)
                        .background(Color(0x14FFFFFF))
                        .border(1.dp, Color(0x40FFFFFF), CircleShape)
                        .clickable { onPlay(group, season.se, ep) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("$ep", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
