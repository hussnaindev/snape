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

/**
 * Shown when the app opens offline for a device whose last access check was
 * granted. Streaming needs a connection, but downloaded titles still play — so
 * the only action is to head to Downloads.
 */
@Composable
fun OfflineNotice(onGoToDownloads: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "You're offline",
            color = Color.White,
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "Browsing needs a connection. Your downloaded titles are still available.",
            color = Color.Gray,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Box(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF1E2A22))
                .clickable(onClick = onGoToDownloads)
                .padding(horizontal = 32.dp, vertical = 12.dp),
        ) {
            Text("Go to Downloads", color = Color.White, fontSize = 15.sp)
        }
    }
}
