package com.snape.flix.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// The download progress accent — a bright→deep green gradient swept around the ring.
private val GreenStart = Color(0xFF34D399)
private val GreenEnd = Color(0xFF059669)

/**
 * A thin circular progress ring with a green gradient sweep, drawn around whatever
 * the caller places behind/inside it. Used as the border-progress around the detail
 * download icon and the home-screen download indicator. [progress] is 0f‥1f.
 */
@Composable
fun ProgressRing(
    progress: Float,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 2.5.dp,
    track: Color = Color(0x33FFFFFF),
) {
    val animated by animateFloatAsState(progress.coerceIn(0f, 1f), label = "ring")
    val brush = Brush.sweepGradient(listOf(GreenEnd, GreenStart, GreenEnd))
    Canvas(modifier) {
        val sw = strokeWidth.toPx()
        val inset = sw / 2f
        val arcSize = androidx.compose.ui.geometry.Size(size.width - sw, size.height - sw)
        val topLeft = androidx.compose.ui.geometry.Offset(inset, inset)
        // Full faint track first, then the green sweep on top.
        drawArc(
            color = track,
            startAngle = 0f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = sw, cap = StrokeCap.Round),
        )
        if (animated > 0f) {
            drawArc(
                brush = brush,
                startAngle = -90f,
                sweepAngle = 360f * animated,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = sw, cap = StrokeCap.Round),
            )
        }
    }
}
