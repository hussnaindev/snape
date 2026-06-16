package com.snape.flix.ui.detail

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.lifecycleScope
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.TmdbPersonCredit
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.launch

class PersonActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_PERSON_ID = "personId"

        fun start(context: Context, personId: Int) {
            context.startActivity(
                Intent(context, PersonActivity::class.java).putExtra(EXTRA_PERSON_ID, personId),
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        val personId = intent.getIntExtra(EXTRA_PERSON_ID, 0)
        if (personId <= 0) {
            finish()
            return
        }

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    PersonScreen(
                        personId = personId,
                        onBack = ::finish,
                        onOpenMovie = ::openMovie,
                    )
                }
            }
        }
    }

    private fun openMovie(credit: TmdbPersonCredit) {
        lifecycleScope.launch {
            val group = runCatching { MovieBoxRepository.search(credit.displayTitle) }
                .getOrNull()
                ?.groups
                ?.firstOrNull()
            if (group != null) {
                DetailActivity.start(this@PersonActivity, group)
            }
        }
    }
}
