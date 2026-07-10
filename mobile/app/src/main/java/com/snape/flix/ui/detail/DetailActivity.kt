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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.snape.flix.SnapeApp
import com.snape.flix.data.AccessDecision
import com.snape.flix.data.AccessGate
import com.snape.flix.data.AccessState
import com.snape.flix.data.MovieBoxRepository
import com.snape.flix.data.SubjectGroup
import com.snape.flix.data.SubjectItem
import com.snape.flix.data.TmdbSearchHit
import com.snape.flix.ui.components.NetworkErrorNotice
import com.snape.flix.ui.components.OfflineNotice
import com.snape.flix.ui.components.RestrictedNotice
import com.snape.flix.ui.components.SnakeLoader
import com.snape.flix.ui.downloads.DownloadsActivity
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

    // Trust a session already verified online this process; otherwise gate on a
    // fresh check before showing content. A process restored straight into this
    // screen (sessionVerified == false) re-checks rather than assuming access.
    private var accessState by mutableStateOf(
        if (AccessGate.sessionVerified) AccessState.Granted else AccessState.Loading,
    )

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

        // Re-verify access before showing content. Instant when the session was
        // already verified online this process; otherwise this hits LD now and
        // blocks a device that has since become restricted (or shows a network
        // error if it can't be checked).
        if (accessState == AccessState.Loading) verifyAccess()

        setContent {
            SnapeTheme {
                Surface(Modifier.fillMaxSize().background(Color.Black), color = Color.Black) {
                    when (accessState) {
                        AccessState.Loading -> Box(
                            Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center,
                        ) {
                            SnakeLoader(size = 56.dp)
                        }
                        AccessState.Denied -> RestrictedNotice()
                        AccessState.Offline -> OfflineNotice(
                            onGoToDownloads = { DownloadsActivity.start(this@DetailActivity) },
                        )
                        AccessState.Error -> NetworkErrorNotice(onRetry = ::verifyAccess)
                        AccessState.Granted -> DetailScreen(
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
    }

    private fun verifyAccess() {
        accessState = AccessState.Loading
        lifecycleScope.launch {
            accessState = when (AccessGate.verifyForContent(application as SnapeApp)) {
                AccessDecision.Granted -> AccessState.Granted
                AccessDecision.Restricted -> AccessState.Denied
                AccessDecision.Offline -> AccessState.Offline
                AccessDecision.NeedsConnection -> AccessState.Error
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
