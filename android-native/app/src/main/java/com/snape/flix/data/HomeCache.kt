package com.snape.flix.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.time.LocalDate

/**
 * On-device cache of the built home screen so a cold start paints instantly
 * instead of waiting on the MovieBox feed + per-section TMDB enrichment.
 *
 * The cache is kept for the day it was written and invalidated on the next
 * calendar day: [load] returns the saved sections only while it's still the same
 * day, so the first launch on a new day refetches fresh data. Within a day a
 * launch reads straight from disk with no network.
 *
 * Backed by [SharedPreferences] with the sections serialized as JSON — the same
 * approach as [LocalStore]. The catalogue is transient/derived data (not user
 * data), so it lives in its own prefs file. [init] must be called once from
 * [com.snape.flix.SnapeApp.onCreate].
 */
object HomeCache {

    private const val PREFS = "snape_home_cache"
    // Bump the suffix when [HomeSection]/[HomeCard] shapes change so an old blob
    // decodes to empty (→ network fallback) instead of throwing.
    private const val KEY_SECTIONS = "home_sections_v1"
    private const val KEY_DAY = "home_saved_epoch_day_v1"

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /**
     * The cached home sections, or empty if there's nothing usable: no cache, an
     * unreadable blob, or a cache written on an earlier calendar day (expired).
     */
    fun load(): List<HomeSection> {
        if (!::prefs.isInitialized) return emptyList()
        val savedDay = prefs.getLong(KEY_DAY, Long.MIN_VALUE)
        if (savedDay != LocalDate.now().toEpochDay()) return emptyList()
        val raw = prefs.getString(KEY_SECTIONS, null) ?: return emptyList()
        return runCatching {
            json.decodeFromString(ListSerializer(HomeSection.serializer()), raw)
        }.getOrDefault(emptyList())
    }

    /** Persist the fully-enriched sections, stamped with today's date. */
    fun save(sections: List<HomeSection>) {
        if (!::prefs.isInitialized || sections.isEmpty()) return
        val raw = runCatching {
            json.encodeToString(ListSerializer(HomeSection.serializer()), sections)
        }.getOrNull() ?: return
        prefs.edit()
            .putString(KEY_SECTIONS, raw)
            .putLong(KEY_DAY, LocalDate.now().toEpochDay())
            .apply()
    }
}
