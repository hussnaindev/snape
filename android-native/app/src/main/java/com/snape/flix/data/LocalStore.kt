package com.snape.flix.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * On-device persistence — NO external DB. Backed by [SharedPreferences] with the
 * payloads serialized as JSON (kotlinx.serialization). Holds two collections:
 *
 *  • **watchlist** — the titles the user saved (their primary [SubjectItem], which
 *    is enough to render the card and reopen the detail page).
 *  • **history** — one [HistoryEntry] per title (keyed by the primary subjectId),
 *    carrying the last season/episode and playback position so Continue Watching
 *    can resume exactly where the user left off.
 *
 * Both are exposed as [StateFlow]s so the home screen, watchlist page and detail
 * page recompose the moment the user adds/removes an item or progress advances.
 * [init] must be called once from [com.snape.flix.SnapeApp.onCreate].
 */
object LocalStore {

    private const val PREFS = "snape_local"
    private const val KEY_WATCHLIST = "watchlist_v1"
    private const val KEY_HISTORY = "history_v1"
    private const val KEY_EP_PROGRESS = "ep_progress_v1"
    // A title counts as "finished" (and drops out of Continue Watching) once it
    // crosses this fraction of its runtime.
    private const val FINISHED_FRACTION = 0.95f

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private lateinit var prefs: SharedPreferences

    private val _watchlist = MutableStateFlow<List<SubjectItem>>(emptyList())
    val watchlist: StateFlow<List<SubjectItem>> = _watchlist.asStateFlow()

    private val _history = MutableStateFlow<List<HistoryEntry>>(emptyList())
    val history: StateFlow<List<HistoryEntry>> = _history.asStateFlow()

    // Per-episode resume points. Continue Watching keeps only one entry per title,
    // so it can't remember where you were in an episode you're not currently on.
    // This holds an independent position for every (title, season, episode) the user
    // has played, so jumping back to an earlier episode resumes that episode — and a
    // never-watched episode has no entry, so it starts from 0.
    private val _epProgress = MutableStateFlow<List<EpProgress>>(emptyList())

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        _watchlist.value = decode(KEY_WATCHLIST, SubjectItem.serializer())
        _history.value = decode(KEY_HISTORY, HistoryEntry.serializer())
        _epProgress.value = decode(KEY_EP_PROGRESS, EpProgress.serializer())
        // First launch after the per-episode store was added: seed it from the
        // existing Continue Watching entries so resume points aren't lost on upgrade.
        if (_epProgress.value.isEmpty() && _history.value.isNotEmpty()) {
            _epProgress.value = _history.value.map {
                EpProgress(it.item.subjectId, it.se, it.ep, it.positionMs, it.durationMs)
            }
            persist(KEY_EP_PROGRESS, EpProgress.serializer(), _epProgress.value)
        }
    }

    // --- watchlist ----------------------------------------------------------

    fun isInWatchlist(subjectId: String): Boolean =
        _watchlist.value.any { it.subjectId == subjectId }

    /** Add the item if absent, remove it if already saved. Most-recent first. */
    fun toggleWatchlist(item: SubjectItem) {
        val current = _watchlist.value
        val next = if (current.any { it.subjectId == item.subjectId }) {
            current.filterNot { it.subjectId == item.subjectId }
        } else {
            listOf(item) + current.filterNot { it.subjectId == item.subjectId }
        }
        _watchlist.value = next
        persist(KEY_WATCHLIST, SubjectItem.serializer(), next)
    }

    fun removeFromWatchlist(subjectId: String) {
        val next = _watchlist.value.filterNot { it.subjectId == subjectId }
        _watchlist.value = next
        persist(KEY_WATCHLIST, SubjectItem.serializer(), next)
    }

    // --- watch history ------------------------------------------------------

    /**
     * Record (or update) playback progress for [item]. One entry per title — the
     * latest season/episode/position wins and the entry moves to the front so the
     * Continue Watching row is ordered most-recently-watched first.
     */
    fun recordProgress(item: SubjectItem, se: Int, ep: Int, positionMs: Long, durationMs: Long) {
        if (positionMs <= 0) return
        val entry = HistoryEntry(
            item = item,
            se = se,
            ep = ep,
            positionMs = positionMs,
            durationMs = durationMs,
            updatedAt = System.currentTimeMillis(),
        )
        val next = listOf(entry) + _history.value.filterNot { it.item.subjectId == item.subjectId }
        _history.value = next.take(50)
        persist(KEY_HISTORY, HistoryEntry.serializer(), _history.value)

        // Also remember this episode's own position independently of Continue Watching.
        val ep0 = EpProgress(item.subjectId, se, ep, positionMs, durationMs)
        val eps = listOf(ep0) + _epProgress.value.filterNot {
            it.subjectId == item.subjectId && it.se == se && it.ep == ep
        }
        _epProgress.value = eps.take(500)
        persist(KEY_EP_PROGRESS, EpProgress.serializer(), _epProgress.value)
    }

    /**
     * Saved resume position for a specific title/season/episode, or null if the
     * episode was never played (→ start from 0) or was already watched to the end
     * (→ start over rather than resume at the credits).
     */
    fun progressFor(subjectId: String, se: Int, ep: Int): Long? =
        _epProgress.value.firstOrNull {
            it.subjectId == subjectId && it.se == se && it.ep == ep
        }?.takeIf { !it.finished }?.positionMs

    /** Continue Watching entries: in-progress (not finished), newest first. */
    fun continueWatching(): List<HistoryEntry> =
        _history.value.filterNot { it.finished }

    fun clearHistory() {
        _history.value = emptyList()
        persist(KEY_HISTORY, HistoryEntry.serializer(), emptyList())
        _epProgress.value = emptyList()
        persist(KEY_EP_PROGRESS, EpProgress.serializer(), emptyList())
    }

    // --- io -----------------------------------------------------------------

    private fun <T> decode(key: String, serializer: kotlinx.serialization.KSerializer<T>): List<T> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return runCatching {
            json.decodeFromString(ListSerializer(serializer), raw)
        }.getOrDefault(emptyList())
    }

    private fun <T> persist(key: String, serializer: kotlinx.serialization.KSerializer<T>, value: List<T>) {
        val raw = runCatching { json.encodeToString(ListSerializer(serializer), value) }.getOrNull()
        prefs.edit().apply { if (raw != null) putString(key, raw) else remove(key) }.apply()
    }

    private val HistoryEntry.finished: Boolean
        get() = durationMs > 0 && positionMs >= durationMs * FINISHED_FRACTION

    private val EpProgress.finished: Boolean
        get() = durationMs > 0 && positionMs >= durationMs * FINISHED_FRACTION
}

/** Per-episode resume point. For movies [se]/[ep] are 0. */
@Serializable
data class EpProgress(
    val subjectId: String,
    val se: Int,
    val ep: Int,
    val positionMs: Long,
    val durationMs: Long,
)

/**
 * One Continue-Watching record. [item] is the primary [SubjectItem] (enough to
 * render a card and reopen detail). For movies [se]/[ep] are 0.
 */
@Serializable
data class HistoryEntry(
    val item: SubjectItem,
    val se: Int,
    val ep: Int,
    val positionMs: Long,
    val durationMs: Long,
    val updatedAt: Long,
) {
    /** 0f‥1f watched fraction, for the progress bar under the card. */
    val fraction: Float
        get() = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
}
