package com.snape.flix

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
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
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.search.SearchScreen
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

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
        checkIpAccess()
        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    when (accessState) {
                        AccessState.Loading -> {
                            Column(
                                Modifier.fillMaxSize(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                CircularProgressIndicator(color = Color.White)
                            }
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

    private fun checkIpAccess() {
        lifecycleScope.launch {
            val ip = fetchPublicIp()
            Log.i("MainActivity", "Public IP: $ip")
            val app = application as SnapeApp
            val client = app.ldClient
            if (client != null && ip != null) {
                val context = LDContext.builder("snape-user")
                    .set("ip", ip)
                    .build()
                client.identify(context)
                val restricted = client.boolVariation("ip-access-restriction", false)
                accessState = if (restricted) AccessState.Denied else AccessState.Granted
            } else {
                accessState = AccessState.Granted
            }
        }
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
