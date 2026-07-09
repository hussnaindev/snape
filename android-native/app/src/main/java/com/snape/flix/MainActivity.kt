package com.snape.flix

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.snape.flix.data.AccessDecision
import com.snape.flix.data.AccessGate
import com.snape.flix.data.AccessState
import com.snape.flix.data.HomePrefetch
import com.snape.flix.ui.components.NetworkErrorNotice
import com.snape.flix.ui.components.OfflineNotice
import com.snape.flix.ui.components.RestrictedNotice
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.downloads.DownloadsActivity
import com.snape.flix.ui.search.SearchScreen
import com.snape.flix.ui.theme.SnapeTheme
import com.snape.flix.ui.tv.LocalIsTv
import com.snape.flix.ui.tv.rememberIsTv
import androidx.compose.runtime.CompositionLocalProvider
import kotlinx.coroutines.launch

private val PageBg = Color(0xFF070B08)

class MainActivity : ComponentActivity() {
    private var accessState by mutableStateOf(AccessState.Loading)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        resolveAccess()
        setContent {
            SnapeTheme {
              CompositionLocalProvider(LocalIsTv provides rememberIsTv()) {
                Surface(Modifier.fillMaxSize().background(PageBg), color = PageBg) {
                    when (accessState) {
                        // One spinner covers both the flag check and the home fetch
                        // — the same branded loader the home screen itself uses.
                        AccessState.Loading -> Box(
                            Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            SnakeLoader(size = 56.dp)
                        }
                        AccessState.Denied -> RestrictedNotice()
                        AccessState.Offline -> OfflineNotice(
                            onGoToDownloads = { DownloadsActivity.start(this@MainActivity) },
                        )
                        AccessState.Error -> NetworkErrorNotice(onRetry = ::resolveAccess)
                        AccessState.Granted -> {
                            SearchScreen(
                                onOpenDetail = { group -> DetailActivity.start(this@MainActivity, group) },
                            )
                        }
                    }
                }
              }
            }
        }
    }

    /**
     * Run the gate and the home load in parallel:
     *  • Granted — wait for the home data, then reveal the home screen so the
     *    launch spinner flows straight into a ready home.
     *  • Restricted — show the restricted screen (online ban, or offline with a
     *    cached restricted verdict).
     *  • Offline — last check was granted but we're offline now: show the offline
     *    screen with a Downloads shortcut.
     *  • NeedsConnection — never verified once (first launch, no network): show the
     *    network-error/retry screen, never the restricted message.
     *
     * Re-runnable: the network-error retry calls this again, restarting the home
     * load (idempotent [HomePrefetch.start]).
     */
    private fun resolveAccess() {
        accessState = AccessState.Loading
        val homeLoad = HomePrefetch.start()
        lifecycleScope.launch {
            when (AccessGate.resolve(application as SnapeApp)) {
                AccessDecision.Granted -> {
                    runCatching { homeLoad.await() }
                    accessState = AccessState.Granted
                }
                AccessDecision.Restricted -> {
                    HomePrefetch.cancel()
                    accessState = AccessState.Denied
                }
                AccessDecision.Offline -> {
                    HomePrefetch.cancel()
                    accessState = AccessState.Offline
                }
                AccessDecision.NeedsConnection -> {
                    HomePrefetch.cancel()
                    accessState = AccessState.Error
                }
            }
        }
    }
}
