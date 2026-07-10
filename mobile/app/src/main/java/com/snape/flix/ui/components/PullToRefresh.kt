package com.snape.flix.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.pullToRefresh
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/**
 * Thin wrapper over the Material3 pull-to-refresh primitives with the app's
 * dark/green styled indicator, so every scrollable screen gets a consistent
 * swipe-to-refresh.
 *
 * Built from `Modifier.pullToRefresh` + [PullToRefreshDefaults.Indicator] (rather
 * than `PullToRefreshBox`) so it can take an [enabled] flag — the detail page turns
 * the gesture off while the inline player is active, where a pull would fight the
 * player chrome.
 *
 * The gesture is driven by the scrollable [content] (a LazyGrid / LazyColumn /
 * verticalScroll Column): pulling down from the top fires [onRefresh]. Keep
 * [isRefreshing] tied to a flag that does NOT blank the content (a dedicated
 * `refreshing` flag rather than the initial `loading`), so the list stays put
 * while the spinner shows.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PullToRefresh(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    val state = rememberPullToRefreshState()
    Box(
        modifier.pullToRefresh(
            isRefreshing = isRefreshing,
            state = state,
            enabled = enabled,
            onRefresh = onRefresh,
        ),
    ) {
        content()
        PullToRefreshDefaults.Indicator(
            modifier = Modifier.align(Alignment.TopCenter),
            isRefreshing = isRefreshing,
            state = state,
            containerColor = Color(0xFF13201A),
            color = Color(0xFF34D399),
        )
    }
}
