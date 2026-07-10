package com.snape.flix.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

private val PageBg = Color(0xFF070B08)

/**
 * Bottom "Free streaming" banner — replica of the web `Banner` component. This is
 * a no-signup app, so the login / sign-up buttons are intentionally omitted; the
 * banner is now just the marketing copy over the artwork.
 */
@Composable
fun HomeBanner(
    modifier: Modifier = Modifier,
) {
    Box(modifier.fillMaxWidth().height(350.dp)) {
        AsyncImage(
            model = "file:///android_asset/apple-tv/slide-1-desktop.webp",
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0.0f to PageBg,
                    0.25f to PageBg.copy(alpha = 0.6f),
                    0.5f to Color.Transparent,
                    1.0f to PageBg,
                ),
            ),
        )

        Column(
            Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, bottom = 32.dp),
        ) {
            Text(
                "Free streaming.",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            Text(
                "Thousands of movies & shows, free.",
                color = Color(0xCCFFFFFF),
                fontSize = 14.sp,
            )
        }
    }
}
