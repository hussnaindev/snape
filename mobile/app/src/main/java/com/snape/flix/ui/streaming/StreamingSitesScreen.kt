package com.snape.flix.ui.streaming

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.snape.flix.data.HomeCard
import com.snape.flix.ui.components.BackChip
import com.snape.flix.ui.components.LinedHeading
import com.snape.flix.ui.components.PullToRefresh
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.home.ProviderSection
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

private val PageBg = Color(0xFF070B08)

@Composable
fun StreamingSitesScreen(
    onOpenDetail: (HomeCard) -> Unit,
    onExplore: (providerKey: String, label: String) -> Unit,
    onBack: () -> Unit,
    viewModel: StreamingSitesViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Box(Modifier.fillMaxSize().background(PageBg)) {
        if (state.loading && state.sections.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                SnakeLoader(size = 56.dp)
            }
        } else {
            PullToRefresh(
                isRefreshing = state.refreshing,
                onRefresh = viewModel::refresh,
                modifier = Modifier.fillMaxSize(),
            ) {
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                ) {
                    Spacer(Modifier.height(56.dp))
                    for (section in state.sections) {
                        ProviderSection(
                            section = section,
                            onOpenCard = onOpenDetail,
                            onExplore = { onExplore(section.key, section.label) },
                        )
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }

        Box(Modifier.fillMaxWidth().background(PageBg)) {
            BackChip(onClick = onBack, modifier = Modifier.align(Alignment.TopStart))
            Box(
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(top = 16.dp, bottom = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                LinedHeading("Streaming Sites", modifier = Modifier.padding(horizontal = 56.dp))
            }
        }
    }
}
