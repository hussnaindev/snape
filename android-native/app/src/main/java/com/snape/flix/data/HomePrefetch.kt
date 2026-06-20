package com.snape.flix.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async

/**
 * Loads the home screen catalogue once per cold start, off the UI thread, so it
 * can run **in parallel** with the LaunchDarkly access check at launch (see
 * [com.snape.flix.MainActivity]).
 *
 *  • [start] kicks off the load, or returns the already in-flight / finished one.
 *    It's idempotent, so both the launch prefetch and the later [HomeViewModel]
 *    share a single load — by the time the home screen is shown the result is
 *    usually already there.
 *  • [cancel] aborts an in-flight load when access is denied: there's no point
 *    finishing a home fetch the user will never see.
 *
 * The load is cache-first: a same-day [HomeCache] hit returns immediately with
 * no network; otherwise it fetches the MovieBox feed + TMDB, enriches the
 * section heroes, and repopulates the cache for the rest of the day.
 */
object HomePrefetch {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var deferred: Deferred<List<HomeSection>>? = null

    /** Start (or reuse) the home load. Safe to call from multiple places. */
    @Synchronized
    fun start(): Deferred<List<HomeSection>> =
        deferred?.takeIf { !it.isCancelled }
            ?: scope.async { loadHome() }.also { deferred = it }

    /** Abort an in-flight load (e.g. access denied) and forget it. */
    @Synchronized
    fun cancel() {
        deferred?.cancel()
        deferred = null
    }

    private suspend fun loadHome(): List<HomeSection> {
        HomeCache.load().let { if (it.isNotEmpty()) return it }
        val base = HomeRepository.buildSections()
        val enriched = HomeRepository.enrichAll(base)
        HomeCache.save(enriched)
        return enriched
    }
}
