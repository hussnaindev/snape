package com.snape.flix.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import com.snape.flix.R

/**
 * Chesna Grotesk — the same custom display face the web app uses
 * (`font-chesna-grotesk`: wordmark, nav labels, card titles). The .ttf in
 * res/font/ was converted from the web's woff2 so the two clients render text
 * identically.
 */
val ChesnaGrotesk = FontFamily(Font(R.font.chesna_grotesk))

/**
 * JetBrains Mono — the dev/terminal monospace used for subtitles, so captions
 * render in an unmistakable fixed-width "code" face.
 */
val MonoFont = FontFamily(Font(R.font.jetbrains_mono))
