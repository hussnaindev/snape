package com.snape.flix.ui.browse

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

/**
 * Hosts the generic catalogue page used by both the provider "Explore" buttons
 * and the genre menu links. The [EXTRA_TITLE] becomes the lined page heading and
 * [EXTRA_QUERY] is the MovieBox keyword searched to fill the grid. Cards open the
 * shared [DetailActivity], so playback stays identical to search results.
 */
class BrowseActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_QUERY = "query"

        fun start(context: Context, title: String, query: String) {
            context.startActivity(
                Intent(context, BrowseActivity::class.java)
                    .putExtra(EXTRA_TITLE, title)
                    .putExtra(EXTRA_QUERY, query),
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val query = intent.getStringExtra(EXTRA_QUERY).orEmpty()
        if (query.isBlank()) {
            finish()
            return
        }

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    BrowseScreen(
                        title = title,
                        query = query,
                        onOpenDetail = { group -> DetailActivity.start(this, group) },
                        onBack = ::finish,
                    )
                }
            }
        }
    }
}
