package com.snape.flix.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

/**
 * The web app's download glyph (a clean stem + chevron + tray), ported 1:1 from
 * `components/ui/download-icon.tsx` so the native download affordances match the
 * web exactly. Stroked (not filled); `Icon`'s tint recolours it at the call site.
 */
val DownloadGlyph: ImageVector by lazy {
    ImageVector.Builder(
        name = "DownloadGlyph",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).apply {
        val stroke = SolidColor(Color.Black) // overridden by Icon tint
        fun stroked(block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit) =
            path(
                stroke = stroke,
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
                pathBuilder = block,
            )
        // M12 3v11  — vertical stem
        stroked { moveTo(12f, 3f); verticalLineToRelative(11f) }
        // m7.5 10.5 4.5 4.5 4.5-4.5  — downward chevron
        stroked { moveTo(7.5f, 10.5f); lineToRelative(4.5f, 4.5f); lineToRelative(4.5f, -4.5f) }
        // M5 19.5h14  — tray / baseline
        stroked { moveTo(5f, 19.5f); horizontalLineToRelative(14f) }
    }.build()
}
