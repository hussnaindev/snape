package com.snape.flix.ui.watchlist

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.theme.SnapeTheme

/** Hosts the local watchlist page (reads from [com.snape.flix.data.LocalStore]). */
class WatchlistActivity : ComponentActivity() {

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, WatchlistActivity::class.java))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    WatchlistScreen(
                        onOpenDetail = { group -> DetailActivity.start(this, group) },
                        onBack = ::finish,
                    )
                }
            }
        }
    }
}
