package com.snape.flix.ui.streaming

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
import com.snape.flix.ui.browse.ProviderBrowseActivity
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.theme.SnapeTheme

class StreamingSitesActivity : ComponentActivity() {

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, StreamingSitesActivity::class.java))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    StreamingSitesScreen(
                        onOpenDetail = { card ->
                            card.toRef()?.let { DetailActivity.start(this@StreamingSitesActivity, it) }
                        },
                        onExplore = { key, label ->
                            ProviderBrowseActivity.start(this@StreamingSitesActivity, label, key)
                        },
                        onBack = ::finish,
                    )
                }
            }
        }
    }
}
