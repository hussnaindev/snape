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
import com.snape.flix.data.SubjectGroup
import com.snape.flix.data.SubjectItem
import com.snape.flix.data.TmdbRef
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.ui.theme.SnapeTheme
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
        private const val EXTRA_REF_JSON = "refJson"
        private const val EXTRA_RESUME_SE = "resumeSe"
        private const val EXTRA_RESUME_EP = "resumeEp"
        // Sentinel meaning "no autoplay on open" (a real resume always has se/ep
        // set, with se=ep=0 being a valid movie target).
        const val NO_RESUME = Int.MIN_VALUE
        private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

        /**
         * Open the detail page from a TMDB ref — the primary entry across the app.
         * TMDB metadata renders immediately while the MovieBox match resolves in
         * parallel for playback.
         */
        fun start(
            context: Context,
            ref: TmdbRef,
            resumeSe: Int = NO_RESUME,
            resumeEp: Int = NO_RESUME,
        ) {
            context.startActivity(
                Intent(context, DetailActivity::class.java)
                    .putExtra(EXTRA_REF_JSON, json.encodeToString(TmdbRef.serializer(), ref))
                    .putExtra(EXTRA_RESUME_SE, resumeSe)
                    .putExtra(EXTRA_RESUME_EP, resumeEp),
            )
        }

        /**
         * Open the detail page from an already-resolved MovieBox group (watchlist /
         * Continue Watching replay) so playback is instant; the full audio-variant
         * set + TMDB metadata fill in afterward.
         */
        fun start(
            context: Context,
            group: SubjectGroup,
            resumeSe: Int = NO_RESUME,
            resumeEp: Int = NO_RESUME,
        ) {
            context.startActivity(
                Intent(context, DetailActivity::class.java)
                    .putExtra(EXTRA_VARIANTS_JSON, json.encodeToString(ListSerializer(SubjectItem.serializer()), group.variants))
                    .putExtra(EXTRA_RESUME_SE, resumeSe)
                    .putExtra(EXTRA_RESUME_EP, resumeEp),
            )
        }

        private fun parseRef(intent: Intent): TmdbRef? {
            val payload = intent.getStringExtra(EXTRA_REF_JSON) ?: return null
            return runCatching { json.decodeFromString(TmdbRef.serializer(), payload) }.getOrNull()
        }

        private fun parseGroup(intent: Intent): SubjectGroup? {
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

        val ref = parseRef(intent)
        val group = if (ref == null) parseGroup(intent) else null
        if (ref == null && group == null) {
            finish()
            return
        }
        val isSeries = ref?.isSeries ?: group!!.primary.isSeries

        val resumeSe = intent.getIntExtra(EXTRA_RESUME_SE, NO_RESUME)
        val resumeEp = intent.getIntExtra(EXTRA_RESUME_EP, NO_RESUME)

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    DetailScreen(
                        isSeries = isSeries,
                        ref = ref,
                        initialGroup = group,
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

    /** Recommendations are TMDB titles → open the detail page by ref; the MovieBox
     *  match resolves there (and is cached). */
    private fun openRecommendation(hit: TmdbSearchHit) {
        start(this, hit.toRef())
    }
}
