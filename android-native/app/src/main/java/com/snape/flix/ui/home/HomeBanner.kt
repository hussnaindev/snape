package com.snape.flix.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

private val PageBg = Color(0xFF070B08)

/** Bottom "Free streaming" banner — replica of the web `Banner` component. */
@Composable
fun HomeBanner(
    onLogin: () -> Unit,
    onSignUp: () -> Unit,
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
                modifier = Modifier.padding(bottom = 16.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                BannerButton("LOGIN", primary = true, onClick = onLogin)
                BannerButton("SIGN UP", primary = false, onClick = onSignUp)
            }
        }
    }
}

@Composable
private fun BannerButton(label: String, primary: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        Modifier
            .height(36.dp)
            .widthIn(min = 112.dp)
            .clip(shape)
            .then(
                if (primary) Modifier.background(Color.White)
                else Modifier.background(Color(0x1AFFFFFF)).border(1.dp, Color(0x33FFFFFF), shape),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (primary) Color.Black else Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.5.sp,
        )
    }
}
