package com.snape.flix.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.snape.flix.ui.theme.ChesnaGrotesk

private val noFontPad = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))

/**
 * The web app's lined section heading — a centred label flanked by hairlines
 * (------ WATCHLIST ------). Shared by the browse, genre and watchlist pages so
 * they all read identically (mirrors the web `SectionDivider`).
 */
@Composable
fun LinedHeading(label: String, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.weight(1f).height(1.dp).background(Color(0x1AFFFFFF)))
        Text(
            label.uppercase(),
            color = Color(0xB3FFFFFF),
            fontFamily = ChesnaGrotesk,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            letterSpacing = 2.sp,
            style = noFontPad,
        )
        Box(Modifier.weight(1f).height(1.dp).background(Color(0x1AFFFFFF)))
    }
}

/**
 * The circular back chip used on the detail page, reused on the browse/genre/
 * watchlist pages so the back affordance is consistent. Sits below the (transparent)
 * status bar via [statusBarsPadding].
 */
@Composable
fun BackChip(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .statusBarsPadding()
            .padding(start = 12.dp, top = 8.dp)
            .size(36.dp)
            .clip(CircleShape)
            .background(Color(0x99000000))
            .border(1.dp, Color(0x4DFFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = "Back",
            tint = Color.White,
            modifier = Modifier.size(18.dp),
        )
    }
}
