package com.snape.flix.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap

/**
 * The web app's download glyph (a clean stem + chevron + tray), ported 1:1 from
 * `components/ui/download-icon.tsx` (paths `M12 3v11`, `m7.5 10.5 4.5 4.5 4.5-4.5`,
 * `M5 19.5h14`). Drawn on a [Canvas] — same approach as [ProgressRing] — so the
 * native download affordances match the web exactly. Size it via [modifier].
 */
@Composable
fun DownloadGlyph(modifier: Modifier = Modifier, tint: Color = Color.White) {
    Canvas(modifier) {
        // Map the web's 24x24 viewBox onto the drawn size. `o` only reads captured
        // vals (a nested function can't see Canvas's DrawScope receiver), while the
        // drawLine calls stay in the lambda body where the receiver is in scope.
        val sx = size.width / 24f
        val sy = size.height / 24f
        val sw = size.minDimension / 12f // ≈ the web's strokeWidth=2 in a 24 box
        fun o(px: Float, py: Float) = Offset(px * sx, py * sy)

        drawLine(tint, o(12f, 3f), o(12f, 14f), strokeWidth = sw, cap = StrokeCap.Round) // stem
        drawLine(tint, o(7.5f, 10.5f), o(12f, 15f), strokeWidth = sw, cap = StrokeCap.Round) // chevron ↙
        drawLine(tint, o(12f, 15f), o(16.5f, 10.5f), strokeWidth = sw, cap = StrokeCap.Round) // chevron ↘
        drawLine(tint, o(5f, 19.5f), o(19f, 19.5f), strokeWidth = sw, cap = StrokeCap.Round) // tray
    }
}
