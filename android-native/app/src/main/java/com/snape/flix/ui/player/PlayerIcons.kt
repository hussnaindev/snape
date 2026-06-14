package com.snape.flix.ui.player

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val PlayIcon: ImageVector by lazy {
    ImageVector.Builder(defaultWidth = 36.dp, defaultHeight = 36.dp, viewportWidth = 36f, viewportHeight = 36f).apply {
        path(fill = SolidColor(Color.White)) {
            moveTo(10.89f, 4.99f)
            curveTo(9.84f, 4.24f, 7.5f, 5.01f, 7.5f, 6.93f)
            verticalLineTo(29.06f)
            curveTo(7.5f, 30.98f, 9.84f, 31.75f, 10.89f, 31f)
            lineTo(29.89f, 19.94f)
            curveTo(31.14f, 19.21f, 31.14f, 17.73f, 29.89f, 17f)
            lineTo(10.89f, 4.99f)
            close()
        }
    }.build()
}

private val PauseIcon: ImageVector by lazy {
    ImageVector.Builder(defaultWidth = 36.dp, defaultHeight = 36.dp, viewportWidth = 36f, viewportHeight = 36f).apply {
        path(fill = SolidColor(Color.White)) {
            moveTo(12.75f, 4.5f); horizontalLineTo(9.75f)
            curveTo(8.51f, 4.5f, 7.5f, 5.51f, 7.5f, 6.75f)
            verticalLineTo(29.25f)
            curveTo(7.5f, 30.49f, 8.51f, 31.5f, 9.75f, 31.5f)
            horizontalLineTo(12.75f)
            curveTo(13.99f, 31.5f, 15f, 30.49f, 15f, 29.25f)
            verticalLineTo(6.75f)
            curveTo(15f, 5.51f, 13.99f, 4.5f, 12.75f, 4.5f)
            close()
            moveTo(26.25f, 4.5f); horizontalLineTo(23.25f)
            curveTo(22.01f, 4.5f, 21f, 5.51f, 21f, 6.75f)
            verticalLineTo(29.25f)
            curveTo(21f, 30.49f, 22.01f, 31.5f, 23.25f, 31.5f)
            horizontalLineTo(26.25f)
            curveTo(27.49f, 31.5f, 28.5f, 30.49f, 28.5f, 29.25f)
            verticalLineTo(6.75f)
            curveTo(28.5f, 5.51f, 27.49f, 4.5f, 26.25f, 4.5f)
            close()
        }
    }.build()
}

@Composable
fun PlayerPlayIcon(modifier: Modifier = Modifier, size: Dp = 26.dp) {
    Icon(PlayIcon, contentDescription = null, tint = Color.White, modifier = modifier.size(size))
}

@Composable
fun PlayerPauseIcon(modifier: Modifier = Modifier, size: Dp = 26.dp) {
    Icon(PauseIcon, contentDescription = null, tint = Color.White, modifier = modifier.size(size))
}

@Composable
fun PlayerSkipBackIcon(modifier: Modifier = Modifier, size: Dp = 22.dp) {
    Icon(
        imageVector = ImageVector.Builder(defaultWidth = size, defaultHeight = size, viewportWidth = 24f, viewportHeight = 24f).apply {
            path(
                fill = SolidColor(Color.Transparent),
                stroke = SolidColor(Color.White),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            ) {
                moveTo(11f, 4f); lineTo(4f, 11f); lineTo(11f, 18f)
                moveTo(4f, 11f); horizontalLineTo(15f)
            }
        }.build(),
        contentDescription = null,
        tint = Color.Unspecified,
        modifier = modifier.size(size),
    )
}

@Composable
fun PlayerSkipForwardIcon(modifier: Modifier = Modifier, size: Dp = 22.dp) {
    Icon(
        imageVector = ImageVector.Builder(defaultWidth = size, defaultHeight = size, viewportWidth = 24f, viewportHeight = 24f).apply {
            path(
                fill = SolidColor(Color.Transparent),
                stroke = SolidColor(Color.White),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            ) {
                moveTo(13f, 4f); lineTo(20f, 11f); lineTo(13f, 18f)
                moveTo(20f, 11f); horizontalLineTo(9f)
            }
        }.build(),
        contentDescription = null,
        tint = Color.Unspecified,
        modifier = modifier.size(size),
    )
}
