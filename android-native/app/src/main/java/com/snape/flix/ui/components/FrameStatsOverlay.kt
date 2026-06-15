package com.snape.flix.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A tiny on-screen frame-time meter — temporary instrumentation to get an
 * objective read on the home-scroll jank without a profiler or adb.
 *
 * It measures the real interval between rendered frames via [withFrameNanos] and,
 * twice a second, shows the achieved FPS plus the single worst frame in that
 * window (in ms). On a smooth 60Hz panel a healthy scroll reads ~"60 · 16ms";
 * jank shows up as a low FPS and a worst-frame well above 16ms (e.g. "32 · 70ms").
 *
 * The measurement loop runs every frame but only writes state at the 500ms
 * boundary, so the overlay itself recomposes ~twice a second and adds no
 * meaningful cost to what it's measuring. Remove once we've localized the cause.
 */
@Composable
fun FrameStatsOverlay(modifier: Modifier = Modifier) {
    var fps by remember { mutableIntStateOf(0) }
    var worstMs by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        var last = 0L
        var frames = 0
        var accum = 0L
        var worst = 0L
        while (true) {
            withFrameNanos { now ->
                if (last != 0L) {
                    val delta = now - last
                    frames++
                    accum += delta
                    if (delta > worst) worst = delta
                }
                last = now
            }
            if (accum >= 500_000_000L) {
                fps = (frames * 1_000_000_000L / accum).toInt()
                worstMs = (worst / 1_000_000L).toInt()
                frames = 0
                accum = 0
                worst = 0
            }
        }
    }

    Text(
        text = "$fps fps · worst ${worstMs}ms",
        color = if (worstMs > 24) Color(0xFFFCA5A5) else Color(0xFF86EFAC),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
            .background(Color(0xCC000000))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}
