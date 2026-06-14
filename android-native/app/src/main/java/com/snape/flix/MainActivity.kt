package com.snape.flix

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.search.SearchScreen
import com.snape.flix.ui.theme.SnapeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Black full-screen splash with the centred white Snape logo.
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    SearchScreen(
                        // Every card opens the detail page; movies and series alike.
                        // Watch/episode playback happens inline on the detail screen.
                        onOpenDetail = { group -> DetailActivity.start(this, group) },
                    )
                }
            }
        }
    }
}
