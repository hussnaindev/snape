package com.snape.flix.data

/**
 * Pure TMDB → MovieBox matching. A Kotlin port of the web `lib/moviebox-match.mjs`
 * (`pickBestMovieboxMatch` / `pickMovieboxVariants` / `detectMovieboxLanguage`),
 * hardened for two defects found by running the web logic against native-shaped
 * data (see MovieBoxMatcherTest):
 *
 *  1. Numbered titles — the web `titleTokens` drops tokens of length ≤ 1, so
 *     "Rocky 2" lost its number and never matched "Rocky II". Here single-char
 *     numeric tokens are kept and low roman numerals are folded to arabic, so
 *     "Rocky II" ≡ "Rocky 2".
 *  2. Variant grouping — the web grouped audio variants only on *exact*
 *     normalized-title equality, so "The Matrix" (Original) never grouped with
 *     "Matrix [Hindi]" (dub) and the dub went missing. Here siblings group on
 *     **title-token-set equality**, which is insensitive to dropped articles /
 *     punctuation but still excludes look-alikes with extra tokens (e.g.
 *     "Inception: The Cobol Job").
 *
 * Native difference vs the web: the mobile BFF `SubjectItem` has NO `postTitle`
 * field — only [SubjectItem.title] (plus [SubjectItem.corner] as a language
 * badge) — so the matcher works off the title alone.
 *
 * Everything here is pure (no I/O); the test battery is the contract.
 */
object MovieBoxMatcher {

    private val STOP_WORDS = setOf("the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for")

    /** Low roman numerals → arabic, for numbered titles ("Rocky II" → "Rocky 2").
     *  Only multi-char numerals are folded — single-char ones (i/v/x) are too
     *  ambiguous with real words ("I Am Legend") to convert safely. */
    private val ROMAN = mapOf(
        "ii" to "2", "iii" to "3", "iv" to "4", "vi" to "6", "vii" to "7",
        "viii" to "8", "ix" to "9", "xi" to "11", "xii" to "12", "xiii" to "13",
    )

    // Source/quality tags that appear in MovieBox bracket suffixes but are NOT a
    // dub language. Anything else inside [...] is treated as the audio language.
    private val QUALITY_TAG = Regex(
        "^(cam|hd|hq|sd|hdr|4k|uhd|web-?dl|web-?rip|blu-?ray|dvd(rip)?|hd-?rip|" +
            "hd-?cam|ts|tc|x264|x265|hevc|\\d{3,4}p)$",
        RegexOption.IGNORE_CASE,
    )

    // --- normalization -------------------------------------------------------

    /** Lowercase, strip accents/brackets/parens/season-ranges/quality tags and
     *  punctuation, collapse whitespace. Mirrors the web `normalizeTitle`. */
    fun normalizeTitle(s: String): String {
        var t = s.lowercase()
        // strip combining marks (accents): NFKD then drop U+0300..U+036F
        t = java.text.Normalizer.normalize(t, java.text.Normalizer.Form.NFKD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
        t = t.replace(Regex("[''`]"), "")
            .replace(Regex("\\[[^\\]]*]|\\([^)]*\\)"), " ") // [..] and (..)
            .replace(Regex("\\bs\\d+\\s*-\\s*s\\d+\\b", RegexOption.IGNORE_CASE), " ") // S1-S4
            .replace(Regex("\\bs\\d+\\b", RegexOption.IGNORE_CASE), " ") // S1
            .replace(Regex("\\{CAM\\}|_1080p|_720p|_480p", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        return t
    }

    /** Significant tokens for set comparison: drop stop-words and single letters,
     *  but KEEP single-digit numbers and fold low roman numerals to arabic. */
    fun titleTokens(s: String): List<String> =
        normalizeTitle(s)
            .split(" ")
            .filter { it.isNotEmpty() }
            .map { ROMAN[it] ?: it }
            .filter { (it.length > 1 || it.all(Char::isDigit)) && it !in STOP_WORDS }

    // --- per-signal scores ---------------------------------------------------

    fun titleMatchScore(tmdbTitle: String, mbTitle: String): Double {
        val t = normalizeTitle(tmdbTitle)
        val m = normalizeTitle(mbTitle)
        if (t.isEmpty() || m.isEmpty()) return 0.0
        if (m == t) return 1.0
        if (m.contains(t)) return 0.95
        if (t.contains(m) && m.length >= 4) return 0.8

        val tTokens = titleTokens(tmdbTitle)
        if (tTokens.isEmpty()) return 0.0
        val mSet = titleTokens(mbTitle).toSet()
        var matched = 0.0
        for (tok in tTokens) {
            if (tok in mSet) matched += 1.0
            else if (mSet.any { it.contains(tok) || tok.contains(it) }) matched += 0.85
        }
        return matched / tTokens.size
    }

    fun yearMatchScore(tmdbYear: Int?, releaseDate: String?): Double {
        val mbY = releaseDate?.take(4)?.toIntOrNull()
        if (tmdbYear == null || mbY == null) return 0.5
        return when (kotlin.math.abs(tmdbYear - mbY)) {
            0 -> 1.0
            1 -> 0.7
            else -> 0.0
        }
    }

    /** MovieBox duration is a human string ("2h 28m" / "95m" / "1h"). Parse to
     *  minutes; when unparseable, the signal is neutral (0.5). */
    fun parseDurationMinutes(duration: String?): Int? {
        if (duration.isNullOrBlank()) return null
        val h = Regex("(\\d+)\\s*h", RegexOption.IGNORE_CASE).find(duration)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        val m = Regex("(\\d+)\\s*m", RegexOption.IGNORE_CASE).find(duration)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        val total = h * 60 + m
        return total.takeIf { it > 0 }
    }

    fun durationMatchScore(tmdbRuntimeMin: Int?, mbDuration: String?): Double {
        val mbMin = parseDurationMinutes(mbDuration)
        if (tmdbRuntimeMin == null || tmdbRuntimeMin <= 0 || mbMin == null) return 0.5
        return when (kotlin.math.abs(tmdbRuntimeMin - mbMin)) {
            in 0..10 -> 1.0
            in 11..20 -> 0.7
            in 21..35 -> 0.4
            else -> 0.0
        }
    }

    fun ratingMatchScore(tmdbVote: Double?, mbImdbRating: String?): Double {
        val mb = mbImdbRating?.toDoubleOrNull()
        if (tmdbVote == null || tmdbVote <= 0.0 || mb == null) return 0.5
        val diff = kotlin.math.abs(tmdbVote - mb)
        return when {
            diff <= 0.4 -> 1.0
            diff <= 0.8 -> 0.75
            diff <= 1.2 -> 0.45
            else -> 0.0
        }
    }

    // --- language detection --------------------------------------------------

    /** Audio language of a MovieBox item from its bracketed title suffix:
     *  "Inception [Hindi]" → "Hindi"; "[Hindi HD]" → "Hindi"; falls back to the
     *  [SubjectItem.corner] badge, then "Original". */
    fun detectLanguage(item: SubjectItem): String {
        for (match in Regex("\\[([^\\]]+)]").findAll(item.title)) {
            val tag = match.groupValues[1].trim().replace(Regex("\\s+"), " ")
            if (tag.isEmpty() || QUALITY_TAG.matches(tag)) continue
            // "Hindi HD" → "Hindi": first word that isn't a pure quality token.
            val lang = tag.split(" ").firstOrNull { !QUALITY_TAG.matches(it) } ?: tag
            return canonicalLanguage(lang)
        }
        val corner = item.corner.trim()
        if (corner.isNotEmpty() && !QUALITY_TAG.matches(corner) && !corner.equals("Original", true)) {
            return canonicalLanguage(corner.split(" ").firstOrNull { !QUALITY_TAG.matches(it) } ?: corner)
        }
        return "Original"
    }

    /** Title-case a detected language so dedupe/labels are stable ("hindi" → "Hindi"). */
    private fun canonicalLanguage(raw: String): String =
        raw.trim().lowercase().replaceFirstChar { it.uppercase() }

    // --- anchor match --------------------------------------------------------

    data class Match(
        val item: SubjectItem,
        val score: Double,
        val titleScore: Double,
        val yearScore: Double,
    )

    private fun typeMismatch(ref: TmdbRef, item: SubjectItem): Boolean =
        (ref.isSeries && item.subjectType == 1) || (!ref.isSeries && item.subjectType == 2)

    private fun score(ref: TmdbRef, item: SubjectItem): Double =
        titleMatchScore(ref.title, item.title) * 0.5 +
            yearMatchScore(ref.yearInt, item.releaseDate) * 0.2 +
            durationMatchScore(ref.runtime, item.duration) * 0.15 +
            ratingMatchScore(ref.voteAverage, item.imdbRatingValue) * 0.15

    /**
     * Score every (playable, right-type) hit and return the best, or null when no
     * hit clears the bar. Exact normalized-title equality is rescued past weak
     * secondary signals, except against a hard year contradiction (wrong-year
     * remake). Mirrors the web `pickBestMovieboxMatch`.
     */
    fun pickBestMatch(ref: TmdbRef, items: List<SubjectItem>, minScore: Double = 0.62, minTitle: Double = 0.55): Match? {
        var best: Match? = null
        for (item in items) {
            if (!item.hasResource) continue
            if (typeMismatch(ref, item)) continue
            val titleScore = titleMatchScore(ref.title, item.title)
            if (titleScore < minTitle) continue
            val total = score(ref, item)
            if (best == null || total > best.score) {
                best = Match(item, total, titleScore, yearMatchScore(ref.yearInt, item.releaseDate))
            }
        }
        val b = best ?: return null
        val exactTitle = b.titleScore >= 1.0
        val yearContradicts = ref.yearInt != null && b.item.releaseDate.isNotBlank() && b.yearScore == 0.0
        val effectiveMin = if (exactTitle && !yearContradicts) minOf(minScore, 0.5) else minScore
        return if (b.score < effectiveMin) null else b
    }

    // --- variants ------------------------------------------------------------

    data class Variant(
        val item: SubjectItem,
        val score: Double,
        val language: String,
        val isOriginal: Boolean,
    )

    private val PREF = listOf("hindi", "english", "tamil", "telugu")

    /**
     * The same title across audio languages (Original + dubs). The anchor is the
     * single best match; siblings are accepted on **title-token-set equality** to
     * the anchor or the TMDB title (so "The Matrix"/"Matrix [Hindi]" group while
     * "Inception: The Cobol Job" never does), with a year-sanity guard. Deduped by
     * detected language (highest score wins; the anchor always wins its slot),
     * ordered Original → Hindi → English → Tamil → Telugu → others.
     */
    fun pickVariants(ref: TmdbRef, items: List<SubjectItem>, maxVariants: Int = 4): List<Variant> {
        val anchor = pickBestMatch(ref, items) ?: return emptyList()
        val anchorTokens = titleTokens(anchor.item.title).toSet()
        val tmdbTokens = titleTokens(ref.title).toSet()

        val byLang = LinkedHashMap<String, Variant>()
        for (item in items) {
            if (!item.hasResource) continue
            if (typeMismatch(ref, item)) continue
            val tokens = titleTokens(item.title).toSet()
            if (tokens.isEmpty()) continue
            if (tokens != anchorTokens && tokens != tmdbTokens) continue
            // Year sanity: drop only hard contradictions (both known, >1yr apart).
            if (ref.yearInt != null && item.releaseDate.isNotBlank() &&
                yearMatchScore(ref.yearInt, item.releaseDate) == 0.0
            ) continue

            val language = detectLanguage(item)
            val s = score(ref, item)
            val prev = byLang[language]
            if (prev == null || s > prev.score) {
                byLang[language] = Variant(item, s, language, language == "Original")
            }
        }

        // The anchor always wins its own language slot, even if a sibling scored higher.
        val anchorLang = detectLanguage(anchor.item)
        byLang[anchorLang] = Variant(anchor.item, anchor.score, anchorLang, anchorLang == "Original")

        return byLang.values
            .sortedWith(
                compareByDescending<Variant> { it.isOriginal }
                    .thenBy { PREF.indexOf(it.language.lowercase()).let { i -> if (i == -1) PREF.size else i } }
                    .thenByDescending { it.score },
            )
            .take(maxVariants)
    }
}
