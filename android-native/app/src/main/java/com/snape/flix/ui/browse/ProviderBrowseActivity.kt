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
import androidx.lifecycle.lifecycleScope
import com.snape.flix.data.HomeCard
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SubjectGroup
import com.snape.flix.ui.detail.DetailActivity
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.launch

class ProviderBrowseActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_PROVIDER = "provider"

        fun start(context: Context, title: String, providerKey: String) {
            context.startActivity(
                Intent(context, ProviderBrowseActivity::class.java)
                    .putExtra(EXTRA_TITLE, title)
                    .putExtra(EXTRA_PROVIDER, providerKey),
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val providerKey = intent.getStringExtra(EXTRA_PROVIDER).orEmpty()
        val tmdbId = providerKey.toIntOrNull()
        if (tmdbId == null) {
            finish()
            return
        }

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    ProviderBrowseScreen(
                        title = title,
                        providerId = tmdbId,
                        onOpenDetail = { card ->
                            lifecycleScope.launch {
                                val group = runCatching {
                                    MovieBoxRepository.search(card.title)
                                }.getOrNull()?.groups?.firstOrNull()
                                if (group != null) DetailActivity.start(this@ProviderBrowseActivity, group)
                            }
                        },
                        onBack = ::finish,
                    )
                }
            }
        }
    }
}
