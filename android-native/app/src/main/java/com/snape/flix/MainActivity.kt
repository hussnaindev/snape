package com.snape.flix

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.launchdarkly.sdk.LDContext
import com.snape.flix.data.HomePrefetch
import com.snape.flix.data.HomeSection
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.search.SearchScreen
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

private val PageBg = Color(0xFF070B08)

private val ipClient = OkHttpClient.Builder()
    .connectTimeout(5, TimeUnit.SECONDS)
    .readTimeout(5, TimeUnit.SECONDS)
    .build()

private enum class AccessState { Loading, Granted, Denied }

class MainActivity : ComponentActivity() {
    private var accessState by mutableStateOf(AccessState.Loading)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Start the home data load and the access (feature-flag) check together,
        // so they run in parallel rather than one after the other.
        val homeLoad = HomePrefetch.start()
        resolveAccess(homeLoad)
        setContent {
            SnapeTheme {
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
                        AccessState.Denied -> {
                            Column(
                                Modifier
                                    .fillMaxSize()
                                    .padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                Text(
                                    "You are restricted to access this content.",
                                    color = Color.White,
                                    fontSize = 18.sp,
                                    textAlign = TextAlign.Center,
                                )
                                Spacer(Modifier.height(12.dp))
                                Text(
                                    "Contact Snape Admin (He Who Must Not Be Named ~ Lord Voldemort)",
                                    color = Color.Gray,
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
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

    /**
     * Resolve access while the home load runs alongside:
     *  • If the flag denies access, cancel the home load (the user won't see it)
     *    and show the restricted screen immediately.
     *  • If the flag allows access, wait for the home data to finish loading and
     *    then reveal the home screen — so the launch spinner flows straight into
     *    a ready home with no second loading stage.
     */
    private fun resolveAccess(homeLoad: Deferred<List<HomeSection>>) {
        lifecycleScope.launch {
            val granted = evaluateAccess()
            if (!granted) {
                HomePrefetch.cancel()
                accessState = AccessState.Denied
                return@launch
            }
            runCatching { homeLoad.await() }
            accessState = AccessState.Granted
        }
    }

    /** Evaluate the `ip-access-restriction` flag for this device's public IP. */
    private suspend fun evaluateAccess(): Boolean = withContext(Dispatchers.IO) {
        val ip = fetchPublicIp()
        Log.i("MainActivity", "Public IP: $ip")
        val app = application as SnapeApp
        // Wait for the SDK's first flag fetch — reading a bare field here races
        // init and silently grants access before the flag is ready.
        val client = app.awaitLdClient()
        if (client == null || ip == null) {
            Log.w("MainActivity", "LD client=$client ip=$ip — granting by default")
            return@withContext true
        }
        val context = LDContext.builder("snape-user")
            .set("ip", ip)
            .build()
        // Block until the new context's flags are loaded, otherwise boolVariation
        // may return the previous context's value.
        client.identify(context).get()
        val restricted = client.boolVariation("ip-access-restriction", false)
        Log.i("MainActivity", "ip-access-restriction=$restricted for ip=$ip")
        // Push the evaluation event now so it shows up in LD without waiting for
        // the default batch interval (helpful when verifying the flow).
        client.flush()
        !restricted
    }

    private suspend fun fetchPublicIp(): String? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url("https://api.ipify.org").build()
            ipClient.newCall(request).execute().body?.string()?.trim()
        } catch (e: Exception) {
            Log.w("MainActivity", "Failed to fetch public IP", e)
            null
        }
    }
}
