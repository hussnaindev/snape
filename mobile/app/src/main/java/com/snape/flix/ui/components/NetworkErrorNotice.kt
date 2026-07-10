package com.snape.flix.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.snape.flix.ui.tv.focusHighlight
import com.snape.flix.ui.tv.initialTvFocus
import com.snape.flix.ui.tv.rememberIsTv

/**
 * Shown when the access check could not be completed (offline / request failed) —
 * a connectivity problem, NOT a restriction. Offers a retry that re-runs the gate.
 */
@Composable
fun NetworkErrorNotice(onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "No internet connection",
            color = Color.White,
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "We couldn't verify your access. Check your connection and try again.",
            color = Color.Gray,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Box(
            Modifier
                .focusHighlight(RoundedCornerShape(8.dp))
                .initialTvFocus(rememberIsTv())
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF1E2A22))
                .clickable(onClick = onRetry)
                .padding(horizontal = 32.dp, vertical = 12.dp),
        ) {
            Text("Retry", color = Color.White, fontSize = 15.sp)
        }
    }
}
