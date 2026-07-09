package com.snape.flix.ui.tv

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.content.pm.PackageManager
import androidx.compose.foundation.border
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex

/**
 * Android-TV support layer.
 *
 * The app is otherwise 100 % touch/gesture driven (`.clickable`, tap/double-tap).
 * On a TV there is no pointer — the user drives a D-pad remote, which needs three
 * things the touch UI never had: a **visible focus indicator**, a sensible
 * **initial focus** so the first key-press does something, and (for the player)
 * **key handling**. These helpers add exactly that without changing the phone UX:
 * on a touchscreen focus is transient so the highlight never lingers, and the
 * initial-focus request is gated on [LocalIsTv].
 */

/** True when running on a TV / leanback device (set once at the app root). */
val LocalIsTv = staticCompositionLocalOf { false }

/** Detect a TV once: leanback launcher devices and the `UI_MODE_TYPE_TELEVISION` mode. */
@Composable
fun rememberIsTv(): Boolean {
    val context = LocalContext.current
    return remember {
        val uiMode = (context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager)
            ?.currentModeType
        uiMode == Configuration.UI_MODE_TYPE_TELEVISION ||
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK) ||
            context.packageManager.hasSystemFeature("android.hardware.type.television")
    }
}

/**
 * Draws a D-pad focus ring (and a gentle lift-scale) around an interactive element
 * while it holds focus. Place this at the **top** of the modifier chain, before the
 * `.clip/.background/.clickable` that makes the element clickable — `onFocusChanged`
 * observes the focus target (`.clickable` is itself focusable) that appears later in
 * the chain, and the scale/zIndex then wrap the whole visual so the focused item
 * lifts above its neighbours.
 *
 * The border colour is transparent when unfocused (a stable, always-present border
 * element — no chain restructuring on focus), so on touch devices this is invisible.
 */
fun Modifier.focusHighlight(
    shape: Shape,
    scale: Float = 1.06f,
    ringColor: Color = Color.White,
    ringWidth: Dp = 2.5.dp,
): Modifier = composed {
    var focused by remember { mutableStateOf(false) }
    this
        .onFocusChanged { focused = it.isFocused }
        // zIndex is a layout property (no render layer) so it stays on always,
        // lifting the focused node above its neighbours in draw order. The lift
        // `scale` is a graphicsLayer, so it is added ONLY while focused — that keeps
        // the dozens of idle cards on the home feed layer-free (the feed's whole
        // performance model is "compose once, then translate"; a permanent layer per
        // card would fight that). A focus change is a discrete D-pad event that
        // relayouts a single node — never something that happens during a fling.
        .zIndex(if (focused) 1f else 0f)
        .then(if (focused) Modifier.scale(scale) else Modifier)
        // A stable, always-present border (transparent when unfocused) keeps the
        // idle chain shape constant — and is invisible on touch, where focus is
        // transient, so the phone UI is unchanged.
        .border(ringWidth, if (focused) ringColor else Color.Transparent, shape)
}

/**
 * Attaches a [FocusRequester] and — on a TV — requests focus once the node is laid
 * out, giving the screen a deterministic starting point for the remote. A no-op on
 * touch devices (so the phone UI never shows a stray highlight on entry).
 */
@Composable
fun Modifier.initialTvFocus(enabled: Boolean): Modifier {
    val requester = remember { FocusRequester() }
    androidx.compose.runtime.LaunchedEffect(enabled) {
        if (enabled) {
            // Let the node get placed before requesting, or requestFocus() throws.
            androidx.compose.runtime.withFrameNanos {}
            runCatching { requester.requestFocus() }
        }
    }
    return this.focusRequester(requester)
}
