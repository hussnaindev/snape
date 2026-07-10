package com.snape.flix.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.snape.flix.R

/**
 * The web app's branded loader (`components/ui/snake-loader.tsx`) rendered
 * natively: a faint white track ring, a spinning 270° white arc with a rounded
 * cap, and the static white Snape logo centered inside. Used everywhere a plain
 * progress spinner used to be (home load, card resolution, search) so loading
 * states match the web identity.
 */
@Composable
fun SnakeLoader(modifier: Modifier = Modifier, size: Dp = 64.dp) {
    val transition = rememberInfiniteTransition(label = "snake")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing), RepeatMode.Restart),
        label = "snakeRot",
    )

    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val dim = this.size.minDimension
            val r = dim * 0.44f
            val c = center
            val topLeft = Offset(c.x - r, c.y - r)
            val arcSize = Size(r * 2, r * 2)

            // faint track ring (web: stroke rgba(255,255,255,0.12), width 3/100)
            drawCircle(
                color = Color(0x1FFFFFFF),
                radius = r,
                center = c,
                style = Stroke(width = dim * 0.03f),
            )
            // spinning 270° arc (web: stroke #fff, width 4.5/100, round cap)
            rotate(degrees = angle, pivot = c) {
                drawArc(
                    color = Color.White,
                    startAngle = -90f,
                    sweepAngle = 270f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = dim * 0.045f, cap = StrokeCap.Round),
                )
            }
        }
        // static centered logo (web: 45% of the loader size)
        Image(
            painter = painterResource(R.drawable.snape_logo),
            contentDescription = "Loading",
            colorFilter = ColorFilter.tint(Color.White),
            modifier = Modifier.size(size * 0.45f),
        )
    }
}
