package com.snape.flix.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.launchdarkly.sdk.LDContext
import com.snape.flix.SnapeApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** UI state for the access-gated screens (launch + detail). */
enum class AccessState { Loading, Granted, Denied, Offline, Error }

/**
 * Final gate decision a screen renders directly:
 *  • [Granted]        — show content.
 *  • [Restricted]     — show the restricted screen (a known ban).
 *  • [Offline]        — last check granted but we're offline now → "you're offline,
 *                       go to Downloads" (the app still opens for downloaded content).
 *  • [NeedsConnection] — never verified once (first launch with no network) → a
 *                       network-error/retry screen, NOT the restricted message.
 */
enum class AccessDecision { Granted, Restricted, Offline, NeedsConnection }

/** Raw outcome of a single live evaluation, before the cache is consulted. */
private enum class EvalResult { Granted, Restricted, Unavailable }

/**
 * Single source of truth for the IP-based content gate, evaluated against the
 * `ip-access-restriction` LaunchDarkly flag for the device's public IP.
 *
 * A first successful check is required, but once a device has been verified the
 * verdict is **persisted** so the app keeps working offline within that verdict:
 *
 *  • Online — evaluate live, cache the verdict, grant or restrict accordingly.
 *  • Offline (or the check fails) — fall back to the cached verdict:
 *      – granted before  → [AccessDecision.Offline] (open for downloads, no home),
 *      – restricted before → [AccessDecision.Restricted] (stays blocked offline),
 *      – never verified  → [AccessDecision.NeedsConnection] (retry screen).
 *
 * This closes the "open offline → enable network → stream" loophole (a restricted
 * device can never reach content offline) while distinguishing a genuine network
 * problem from a ban.
 */
object AccessGate {

    private const val PREFS = "snape_access"
    private const val KEY_GRANTED = "access_granted_v1"

    private val ipClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    private lateinit var prefs: SharedPreferences

    // Set once a live check this process returns Granted. Lets the detail gate skip
    // a redundant round trip within an already-verified session.
    @Volatile
    private var sessionGranted = false

    /** True once a live check has granted access in this process. */
    val sessionVerified: Boolean get() = sessionGranted

    /** Must be called once from [SnapeApp.onCreate]. */
    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /** Last verdict persisted from a successful check, or null if never verified. */
    private fun cachedGranted(): Boolean? =
        if (prefs.contains(KEY_GRANTED)) prefs.getBoolean(KEY_GRANTED, true) else null

    /**
     * Resolve access for the app/home gate: evaluate live, otherwise fall back to
     * the cached verdict (see class docs for the offline mapping).
     */
    suspend fun resolve(app: SnapeApp): AccessDecision = when (evaluate(app)) {
        EvalResult.Granted -> {
            prefs.edit().putBoolean(KEY_GRANTED, true).apply()
            AccessDecision.Granted
        }
        EvalResult.Restricted -> {
            prefs.edit().putBoolean(KEY_GRANTED, false).apply()
            AccessDecision.Restricted
        }
        EvalResult.Unavailable -> when (cachedGranted()) {
            true -> AccessDecision.Offline
            false -> AccessDecision.Restricted
            null -> AccessDecision.NeedsConnection
        }
    }

    /**
     * Gate used before content is accessed (detail page). Trusts a session already
     * verified this process; otherwise resolves fresh.
     */
    suspend fun verifyForContent(app: SnapeApp): AccessDecision =
        if (sessionGranted) AccessDecision.Granted else resolve(app)

    /**
     * One live evaluation. [EvalResult.Unavailable] whenever the public IP or LD
     * client can't be obtained, or the flag check throws — i.e. whenever we can't
     * positively determine the verdict.
     */
    private suspend fun evaluate(app: SnapeApp): EvalResult = withContext(Dispatchers.IO) {
        val ip = fetchPublicIp() ?: return@withContext EvalResult.Unavailable
        val client = app.awaitLdClient() ?: return@withContext EvalResult.Unavailable
        try {
            val context = LDContext.builder("snape-user")
                .set("ip", ip)
                .build()
            // Block until the new context's flags load, otherwise boolVariation may
            // return the previous context's value.
            client.identify(context).get()
            val restricted = client.boolVariation("ip-access-restriction", false)
            // Push the evaluation event now so it shows up in LD without waiting for
            // the default batch interval (helpful when verifying the flow).
            client.flush()
            Log.i("AccessGate", "ip-access-restriction=$restricted for ip=$ip")
            if (restricted) {
                sessionGranted = false
                EvalResult.Restricted
            } else {
                sessionGranted = true
                EvalResult.Granted
            }
        } catch (e: Exception) {
            Log.w("AccessGate", "Flag check failed — treating as unavailable", e)
            EvalResult.Unavailable
        }
    }

    private suspend fun fetchPublicIp(): String? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url("https://api.ipify.org").build()
            ipClient.newCall(request).execute().body?.string()?.trim()
        } catch (e: Exception) {
            Log.w("AccessGate", "Failed to fetch public IP", e)
            null
        }
    }
}
