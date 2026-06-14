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
 * Space Mono — the classical/noir monospace face used for subtitles and the
 * player's option menus, matching the web app's caption styling.
 */
val SpaceMono = FontFamily(Font(R.font.space_mono))
