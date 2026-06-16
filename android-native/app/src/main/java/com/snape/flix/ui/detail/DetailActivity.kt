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
import com.snape.flix.data.SubjectGroup
import com.snape.flix.data.SubjectItem
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.ui.theme.SnapeTheme
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * Hosts the detail page (a pixel replica of the web app's mobile detail screen).
 * The MovieBox [SubjectGroup] travels in via JSON (its variants list, primary
 * first); TMDB enrichment is fetched on-device by [DetailViewModel].
 */
class DetailActivity : ComponentActivity() {

    companion object {
        private const val EXTRA_VARIANTS_JSON = "variantsJson"
        private const val EXTRA_RESUME_SE = "resumeSe"
        private const val EXTRA_RESUME_EP = "resumeEp"
        // Sentinel meaning "no autoplay on open" (a real resume always has se/ep
        // set, with se=ep=0 being a valid movie target).
        const val NO_RESUME = Int.MIN_VALUE
        private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

        /**
         * Open the detail page. When [resumeSe]/[resumeEp] are provided (Continue
         * Watching) the page autostarts that episode and seeks to the saved
         * position; otherwise it opens idle on the backdrop/trailer.
         */
        fun start(
            context: Context,
            group: SubjectGroup,
            resumeSe: Int = NO_RESUME,
            resumeEp: Int = NO_RESUME,
        ) {
            val payload = json.encodeToString(
                ListSerializer(SubjectItem.serializer()),
                group.variants,
            )
            context.startActivity(
                Intent(context, DetailActivity::class.java)
                    .putExtra(EXTRA_VARIANTS_JSON, payload)
                    .putExtra(EXTRA_RESUME_SE, resumeSe)
                    .putExtra(EXTRA_RESUME_EP, resumeEp),
            )
        }

        private fun parse(intent: Intent): SubjectGroup? {
            val payload = intent.getStringExtra(EXTRA_VARIANTS_JSON) ?: return null
            val variants = runCatching {
                json.decodeFromString(ListSerializer(SubjectItem.serializer()), payload)
            }.getOrNull().orEmpty()
            val primary = variants.firstOrNull() ?: return null
            return SubjectGroup(primary, variants)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Allow the fullscreen player overlay to draw into a notch/cutout.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        val group = parse(intent)
        if (group == null) {
            finish()
            return
        }

        val resumeSe = intent.getIntExtra(EXTRA_RESUME_SE, NO_RESUME)
        val resumeEp = intent.getIntExtra(EXTRA_RESUME_EP, NO_RESUME)

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    DetailScreen(
                        group = group,
                        onOpenRecommendation = ::openRecommendation,
                        onBack = ::finish,
                        onOpenPerson = ::openPerson,
                        resumeSe = resumeSe,
                        resumeEp = resumeEp,
                    )
                }
            }
        }
    }

    private fun openPerson(personId: Int) {
        PersonActivity.start(this, personId)
    }

    /**
     * Recommendations come from TMDB, which the player can't stream directly.
     * Re-search MovieBox for the title and open that result's detail page so the
     * native app stays fully self-contained and playable.
     */
    private fun openRecommendation(hit: TmdbSearchHit) {
        lifecycleScope.launch {
            val group = runCatching { MovieBoxRepository.search(hit.displayTitle) }
                .getOrNull()
                ?.groups
                ?.firstOrNull()
            if (group != null) start(this@DetailActivity, group)
        }
    }
}
