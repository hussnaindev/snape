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
import androidx.lifecycle.lifecycleScope
import com.snape.flix.data.HomeCard
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.launch

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
                            lifecycleScope.launch {
                                val group = runCatching {
                                    MovieBoxRepository.search(card.title)
                                }.getOrNull()?.groups?.firstOrNull()
                                if (group != null) DetailActivity.start(this@StreamingSitesActivity, group)
                            }
                        },
                        onBack = ::finish,
                    )
                }
            }
        }
    }
}
