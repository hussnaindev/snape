package com.snape.flix.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Monochromatic palette — pure black canvas, white ink, grey accents.
val SnapeBlack = Color(0xFF000000)
val SnapeNearBlack = Color(0xFF0A0A0A)
val SnapeSurface = Color(0xFF141414)
val SnapeWhite = Color(0xFFFFFFFF)
val SnapeMuted = Color(0xFF8A8A8A)
val SnapeFaint = Color(0x14FFFFFF) // white @ 8%
val SnapeHairline = Color(0x40FFFFFF) // white @ 25%

private val SnapeColors = darkColorScheme(
    primary = SnapeWhite,
    onPrimary = SnapeBlack,
    secondary = SnapeMuted,
    background = SnapeBlack,
    onBackground = SnapeWhite,
    surface = SnapeNearBlack,
    onSurface = SnapeWhite,
    surfaceVariant = SnapeSurface,
    onSurfaceVariant = SnapeMuted,
    outline = SnapeHairline,
)

private val SnapeTypography = Typography(
    titleLarge = TextStyle(
        fontFamily = ChesnaGrotesk,
        fontWeight = FontWeight.Light,
        fontSize = 22.sp,
        letterSpacing = 4.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = ChesnaGrotesk,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = ChesnaGrotesk,
        fontWeight = FontWeight.SemiBold,
        fontSize = 9.sp,
        letterSpacing = 1.5.sp,
    ),
)

@Composable
fun SnapeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SnapeColors,
        typography = SnapeTypography,
        content = content,
    )
}
