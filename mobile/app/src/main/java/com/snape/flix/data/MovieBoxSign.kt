package com.snape.flix.data

import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject

/**
 * Request signing for the MovieBox mobile BFF. Ported from the proven
 * server implementation (netlify/lib/moviebox.mjs) and the v3 scheme in
 * Simatwa/moviebox-api.
 *
 *  x-tr-signature = "<ts>|2|<base64(HMAC-MD5(canonical, key))>"
 *  canonical = METHOD\nAccept\nContentType\nbodyLen\nts\nbodyHash\ncanonicalUrl
 *
 *  - For GET: body is null -> bodyLen and bodyHash are empty strings,
 *    canonicalUrl = "<path>?<query>" with query keys sorted, values NOT encoded.
 *  - For POST (search): canonicalUrl = "<path>" (search carries no query string)
 *    and bodyHash = md5hex(body bytes).
 *  - key is the base64-alphabet secret, base64-DECODED to bytes before HMAC.
 *  - No Authorization bearer is ever sent (a stale token => 401 before signing).
 */
object MovieBoxSign {
    private const val SECRET_KEY = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O"
    private const val BODY_MAX_BYTES = 102_400

    /**
     * Impersonated MovieBox Android client version. The BFF **version-gates
     * playback**: a stale [APP_VERSION_CODE] makes `play-info` hand back a
     * "please update" promo clip as the stream instead of the real one (search
     * and the home feed keep working, so it looks like playback, not an error).
     * When every title suddenly plays an "update MovieBox" promo, bump these to
     * the current shipping build (`version_name` / `versionCode` from the live
     * APK — e.g. via apkcombo/uptodown/platinmods listings) and update
     * [USER_AGENT] to match.
     */
    const val APP_VERSION = "3.0.16.0721.03"
    const val APP_VERSION_CODE = 50020116L

    private val rng = SecureRandom()

    @Volatile private var runtimeToken: String? = null

    fun absorbToken(responseHeaders: Map<String, List<String>>?) {
        if (responseHeaders == null) return
        val raw = responseHeaders["x-user"]?.firstOrNull() ?: responseHeaders["X-User"]?.firstOrNull() ?: return
        try {
            JSONObject(raw).optString("token").takeIf { it.isNotBlank() }?.also { runtimeToken = it }
        } catch (_: Exception) {}
    }

    val authBearerToken: String? get() = runtimeToken

    private fun md5Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("MD5").digest(bytes)
        val sb = StringBuilder(digest.size * 2)
        for (b in digest) sb.append("%02x".format(b))
        return sb.toString()
    }

    private fun hmacMd5Base64(canonical: String): String {
        val key = Base64.decode(SECRET_KEY, Base64.DEFAULT)
        val mac = Mac.getInstance("HmacMD5")
        mac.init(SecretKeySpec(key, "HmacMD5"))
        val out = mac.doFinal(canonical.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    /** X-Client-Token = "<ts>,<md5(reverse(<ts>))>" */
    fun clientToken(ts: Long): String {
        val s = ts.toString()
        return "$s,${md5Hex(s.reversed().toByteArray(Charsets.UTF_8))}"
    }

    /**
     * @param sortedQuery already-sorted "k=v&k=v" string (values unencoded), or "".
     * @param body request body for POST, or null for GET.
     */
    fun signature(method: String, path: String, sortedQuery: String, body: String?, ts: Long): String {
        val canonicalUrl = if (sortedQuery.isNotEmpty()) "$path?$sortedQuery" else path
        val bodyBytes = body?.toByteArray(Charsets.UTF_8)
        val bodyLen = bodyBytes?.size?.toString() ?: ""
        val bodyHash = if (bodyBytes != null) {
            md5Hex(bodyBytes.copyOfRange(0, minOf(bodyBytes.size, BODY_MAX_BYTES)))
        } else {
            ""
        }
        val canonical = listOf(
            method.uppercase(),
            "application/json",
            "application/json",
            bodyLen,
            ts.toString(),
            bodyHash,
            canonicalUrl,
        ).joinToString("\n")
        return "$ts|2|${hmacMd5Base64(canonical)}"
    }

    /** Per-request device fingerprint, mirroring the Android app payload. */
    fun clientInfo(): String {
        val deviceBytes = ByteArray(16).also { rng.nextBytes(it) }
        val deviceId = deviceBytes.joinToString("") { "%02x".format(it) }
        val gaid = UUID.randomUUID().toString()
        return """{"package_name":"com.community.oneroom","version_name":"$APP_VERSION",""" +
            """"version_code":$APP_VERSION_CODE,"os":"android","os_version":"13","install_ch":"ps",""" +
            """"device_id":"$deviceId","install_store":"ps","gaid":"$gaid","brand":"Redmi",""" +
            """"model":"23078RKD5C","system_language":"en","net":"NETWORK_WIFI","region":"US",""" +
            """"timezone":"America/New_York","sp_code":"40401","X-Play-Mode":"2"}"""
    }

    const val USER_AGENT =
        "com.community.oneroom/$APP_VERSION_CODE (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)"
}
