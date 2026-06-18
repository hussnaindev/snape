package com.snape.flix.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Gating battery for [MovieBoxMatcher]. The matcher must NOT be wired into the app
 * until this is green. Covers the categories that the pre-port empirical run
 * exercised against the web logic — including the two regressions that port fixes
 * (numbered titles, article-drop variant grouping) and the hasResource rule.
 */
class MovieBoxMatcherTest {

    // --- builders ------------------------------------------------------------

    private var idSeq = 0
    private fun mb(
        title: String,
        year: String = "2010",
        duration: String = "2h 28m",
        rating: String = "8.0",
        series: Boolean = false,
        hasResource: Boolean = true,
        corner: String = "",
        id: String = "s${idSeq++}",
    ) = SubjectItem(
        subjectId = id,
        subjectType = if (series) 2 else 1,
        title = title,
        releaseDate = if (year.isBlank()) "" else "$year-01-01",
        duration = duration,
        imdbRatingValue = rating,
        corner = corner,
        hasResource = hasResource,
    )

    private fun ref(
        title: String,
        year: String = "2010",
        runtime: Int? = 148,
        vote: Double? = 8.0,
        series: Boolean = false,
    ) = TmdbRef(id = 1, isSeries = series, title = title, year = year, runtime = runtime, voteAverage = vote)

    // ============================ NORMALIZATION =============================

    @Test fun normalize_strips_punctuation_accents_brackets() {
        assertEquals("the matrix", MovieBoxMatcher.normalizeTitle("The Matrix"))
        assertEquals("amelie", MovieBoxMatcher.normalizeTitle("Amélie"))
        assertEquals("oceans eleven", MovieBoxMatcher.normalizeTitle("Ocean's Eleven"))
        assertEquals("mission impossible", MovieBoxMatcher.normalizeTitle("Mission: Impossible"))
        assertEquals("inception", MovieBoxMatcher.normalizeTitle("Inception [Hindi]"))
        assertEquals("inception", MovieBoxMatcher.normalizeTitle("Inception (2010)"))
        assertEquals("from", MovieBoxMatcher.normalizeTitle("From S1-S4"))
        assertEquals("dangal", MovieBoxMatcher.normalizeTitle("Dangal{CAM}_1080P").trim())
    }

    @Test fun tokens_keep_numbers_and_fold_roman() {
        assertEquals(setOf("rocky", "2"), MovieBoxMatcher.titleTokens("Rocky 2").toSet())
        assertEquals(setOf("rocky", "2"), MovieBoxMatcher.titleTokens("Rocky II").toSet())
        assertEquals(setOf("rocky", "3"), MovieBoxMatcher.titleTokens("Rocky III").toSet())
        // articles + single letters dropped, but real words kept
        assertEquals(setOf("matrix"), MovieBoxMatcher.titleTokens("The Matrix").toSet())
        assertEquals(setOf("matrix"), MovieBoxMatcher.titleTokens("Matrix").toSet())
        // "i" must NOT become a number (avoids "I Am Legend" corruption)
        assertEquals(setOf("am", "legend"), MovieBoxMatcher.titleTokens("I Am Legend").toSet())
    }

    // ============================ TITLE SCORE ===============================

    @Test fun titleScore_exact_and_substring() {
        assertEquals(1.0, MovieBoxMatcher.titleMatchScore("Inception", "Inception"), 0.0)
        assertEquals(1.0, MovieBoxMatcher.titleMatchScore("Inception", "Inception [Hindi]"), 0.0)
        assertTrue(MovieBoxMatcher.titleMatchScore("The Matrix", "Matrix") >= 0.8)
        assertTrue(MovieBoxMatcher.titleMatchScore("Rocky II", "Rocky 2") >= 0.9)
        assertTrue(MovieBoxMatcher.titleMatchScore("Fast & Furious", "Fast and Furious") >= 0.9)
        assertTrue(MovieBoxMatcher.titleMatchScore("Inception", "Avatar") < 0.4)
    }

    // ============================ YEAR / DURATION / RATING ==================

    @Test fun yearScore_buckets() {
        assertEquals(1.0, MovieBoxMatcher.yearMatchScore(2010, "2010-07-16"), 0.0)
        assertEquals(0.7, MovieBoxMatcher.yearMatchScore(2010, "2011-01-01"), 0.0)
        assertEquals(0.0, MovieBoxMatcher.yearMatchScore(2010, "1984-01-01"), 0.0)
        assertEquals(0.5, MovieBoxMatcher.yearMatchScore(null, "2010-01-01"), 0.0)
        assertEquals(0.5, MovieBoxMatcher.yearMatchScore(2010, ""), 0.0)
    }

    @Test fun durationParse_and_score() {
        assertEquals(148, MovieBoxMatcher.parseDurationMinutes("2h 28m"))
        assertEquals(95, MovieBoxMatcher.parseDurationMinutes("95m"))
        assertEquals(60, MovieBoxMatcher.parseDurationMinutes("1h"))
        assertNull(MovieBoxMatcher.parseDurationMinutes(""))
        assertNull(MovieBoxMatcher.parseDurationMinutes("foo"))
        assertEquals(1.0, MovieBoxMatcher.durationMatchScore(148, "2h 28m"), 0.0)
        assertEquals(0.5, MovieBoxMatcher.durationMatchScore(148, "foo"), 0.0) // neutral when unparseable
        assertEquals(0.0, MovieBoxMatcher.durationMatchScore(148, "30m"), 0.0)
    }

    @Test fun ratingScore_buckets() {
        assertEquals(1.0, MovieBoxMatcher.ratingMatchScore(8.4, "8.4"), 0.0)
        assertEquals(0.75, MovieBoxMatcher.ratingMatchScore(8.4, "7.8"), 0.0)
        assertEquals(0.5, MovieBoxMatcher.ratingMatchScore(8.4, ""), 0.0)
        assertEquals(0.5, MovieBoxMatcher.ratingMatchScore(null, "8.4"), 0.0)
    }

    // ============================ LANGUAGE DETECTION ========================

    @Test fun language_detection() {
        assertEquals("Hindi", MovieBoxMatcher.detectLanguage(mb("Inception [Hindi]")))
        assertEquals("Tamil", MovieBoxMatcher.detectLanguage(mb("Inception [Tamil]")))
        assertEquals("Original", MovieBoxMatcher.detectLanguage(mb("Inception")))
        // bracket is a quality tag, not a language
        assertEquals("Original", MovieBoxMatcher.detectLanguage(mb("Inception [1080p]")))
        // quality-tagged language → strip the quality token
        assertEquals("Hindi", MovieBoxMatcher.detectLanguage(mb("Inception [Hindi HD]")))
        // multi-bracket: first non-quality wins
        assertEquals("Hindi", MovieBoxMatcher.detectLanguage(mb("Inception [Hindi][CAM]")))
        // corner fallback when no bracket
        assertEquals("Telugu", MovieBoxMatcher.detectLanguage(mb("Pushpa", corner = "Telugu")))
    }

    // ============================ ANCHOR MATCH ==============================

    @Test fun anchor_exact_titles_match() {
        val cases = listOf(
            ref("The Matrix", "1999", 136, 8.2) to mb("The Matrix", "1999", "2h 16m", "8.2"),
            ref("The Matrix", "1999", 136, 8.2) to mb("Matrix", "1999", "2h 16m", "8.2"), // article dropped in MB
            ref("Rocky II", "1979", 119, 7.3) to mb("Rocky 2", "1979", "1h 59m", "7.3"),
            ref("Mission: Impossible", "1996", 110, 7.1) to mb("Mission Impossible", "1996", "1h 50m", "7.1"),
            ref("Fast & Furious", "2009", 107, 6.6) to mb("Fast and Furious", "2009", "1h 47m", "6.6"),
            ref("Amélie", "2001", 122, 7.9) to mb("Amelie", "2001", "2h 2m", "7.9"),
            ref("Ocean's Eleven", "2001", 116, 7.2) to mb("Oceans Eleven", "2001", "1h 56m", "7.2"),
            ref("Parasite", "2019", 132, 8.5) to mb("Parasite", "2020", "2h 12m", "8.5"), // year off-by-one
        )
        for ((r, item) in cases) {
            assertNotNull("should match: ${r.title} ~ ${item.title}", MovieBoxMatcher.pickBestMatch(r, listOf(item)))
        }
    }

    @Test fun anchor_rejects_wrong_titles_and_remakes() {
        // wrong-year remake, same title
        assertNull(MovieBoxMatcher.pickBestMatch(ref("Dune", "2021", 155, 7.8), listOf(mb("Dune", "1984", "2h 16m", "6.3"))))
        // unrelated titles
        assertNull(MovieBoxMatcher.pickBestMatch(ref("Inception", "2010"), listOf(mb("The Shawshank Redemption", "1994"))))
        assertNull(MovieBoxMatcher.pickBestMatch(ref("Inception", "2010"), listOf(mb("In the Grey", "2026"))))
        // sequel present but base wanted with contradicting year → reject
        assertNull(MovieBoxMatcher.pickBestMatch(ref("John Wick: Chapter 4", "2023", 169, 7.8), listOf(mb("John Wick", "2014", "1h 41m", "7.4"))))
    }

    @Test fun anchor_exact_title_rescue_low_signal() {
        // exact title, no year, bad duration+rating → rescued (below normal bar)
        val m = MovieBoxMatcher.pickBestMatch(ref("Inception", "2010", 148, 8.4), listOf(mb("Inception", "", "1m", "3.0")))
        assertNotNull("exact title rescued past weak secondary signals", m)
        assertTrue("case must be below normal bar to prove rescue", m!!.score < 0.62)
        // but exact title with CONTRADICTING year is not rescued
        assertNull(MovieBoxMatcher.pickBestMatch(ref("Inception", "2010", 148, 8.4), listOf(mb("Inception", "1995", "1m", "3.0"))))
    }

    @Test fun anchor_type_filtering() {
        // tv ref must not match a movie subject and vice-versa
        assertNull(MovieBoxMatcher.pickBestMatch(ref("From", "2022", 60, 7.8, series = true), listOf(mb("From", "2022", "1h", "7.8", series = false))))
        assertNull(MovieBoxMatcher.pickBestMatch(ref("From", "2022", 120, 7.8, series = false), listOf(mb("From", "2022", "2h", "7.8", series = true))))
        // correct type matches
        assertNotNull(MovieBoxMatcher.pickBestMatch(ref("From", "2022", 60, 7.8, series = true), listOf(mb("From S1-S4", "2022", "1h", "7.8", series = true))))
    }

    @Test fun anchor_hasResource_rule() {
        // alone, resourceless → no match
        assertNull(MovieBoxMatcher.pickBestMatch(ref("Tenet", "2020", 150, 7.3), listOf(mb("Tenet", "2020", "2h 30m", "7.3", hasResource = false))))
        // resourceful twin present → pick the resourceful one
        val m = MovieBoxMatcher.pickBestMatch(
            ref("Tenet", "2020", 150, 7.3),
            listOf(
                mb("Tenet", "2020", "2h 30m", "7.3", hasResource = false, id = "NO"),
                mb("Tenet", "2020", "2h 30m", "7.3", hasResource = true, id = "YES"),
            ),
        )
        assertEquals("YES", m?.item?.subjectId)
    }

    @Test fun anchor_picks_highest_scoring_among_many() {
        val items = listOf(
            mb("Inception: The Cobol Job", "2010", "1h", "7.5", id = "C"),
            mb("Inception", "2010", "2h 28m", "8.4", id = "O"),
            mb("Inceptionish", "2011", "2h", "5.0", id = "X"),
        )
        val m = MovieBoxMatcher.pickBestMatch(ref("Inception", "2010", 148, 8.4), items)
        assertEquals("O", m?.item?.subjectId)
    }

    // ============================ VARIANTS (the bug) ========================

    @Test fun variants_original_first_and_grouped() {
        val items = listOf(
            mb("3 Idiots [Tamil]", "2009", "2h 50m", "8.4", id = "T"),
            mb("3 Idiots", "2009", "2h 50m", "8.4", id = "O"),
            mb("3 Idiots [Hindi]", "2009", "2h 50m", "8.4", id = "H"),
        )
        val v = MovieBoxMatcher.pickVariants(ref("3 Idiots", "2009", 170, 8.4), items)
        assertEquals(3, v.size)
        assertTrue(v[0].isOriginal)
        assertEquals("O", v[0].item.subjectId)
        assertTrue(v.any { it.language == "Hindi" })
        assertTrue(v.any { it.language == "Tamil" })
    }

    @Test fun variants_include_english_and_original_missing_variant_bug() {
        val items = listOf(
            mb("RRR [Hindi]", "2022", "3h 2m", "7.8", id = "H"),
            mb("RRR [English]", "2022", "3h 2m", "7.8", id = "E"),
            mb("RRR", "2022", "3h 2m", "7.8", id = "O"),
        )
        val v = MovieBoxMatcher.pickVariants(ref("RRR", "2022", 182, 7.8), items)
        assertTrue("English variant present", v.any { it.language.equals("English", true) })
        assertTrue("Original present", v.any { it.isOriginal })
        // ordering: Original then Hindi then English
        assertEquals(listOf("Original", "Hindi", "English"), v.map { it.language })
    }

    @Test fun variants_article_drop_groups_dub_REGRESSION() {
        // The web bug: "The Matrix" (Original) + "Matrix [Hindi]" (dub) failed to group.
        val items = listOf(
            mb("The Matrix", "1999", "2h 16m", "8.2", id = "O"),
            mb("Matrix [Hindi]", "1999", "2h 16m", "8.2", id = "H"),
        )
        val v = MovieBoxMatcher.pickVariants(ref("The Matrix", "1999", 136, 8.2), items)
        assertEquals(2, v.size)
        assertTrue(v.any { it.item.subjectId == "H" })
    }

    @Test fun variants_year_drift_still_groups() {
        // dubs released a few weeks later (still same year) must group
        val items = listOf(
            mb("Pathaan", "2023", "2h 26m", "6.0", id = "O"),
            mb("Pathaan [Tamil]", "2023", "2h 26m", "6.0", id = "T"),
        )
        val v = MovieBoxMatcher.pickVariants(ref("Pathaan", "2023", 146, 6.0), items)
        assertEquals(2, v.size)
    }

    @Test fun variants_exclude_lookalike_sequel() {
        val items = listOf(
            mb("Inception", "2010", "2h 28m", "8.4", id = "O"),
            mb("Inception: The Cobol Job", "2010", "1h", "7.5", id = "C"),
        )
        val v = MovieBoxMatcher.pickVariants(ref("Inception", "2010", 148, 8.4), items)
        assertFalse("must not group the look-alike sequel", v.any { it.item.subjectId == "C" })
    }

    @Test fun variants_resourceless_original_dropped_dub_kept() {
        val items = listOf(
            mb("Dangal", "2016", "2h 41m", "8.4", hasResource = false, id = "O"),
            mb("Dangal [Hindi]", "2016", "2h 41m", "8.4", hasResource = true, id = "H"),
        )
        val v = MovieBoxMatcher.pickVariants(ref("Dangal", "2016", 161, 8.4), items)
        assertFalse(v.any { it.item.subjectId == "O" })
        assertTrue(v.any { it.item.subjectId == "H" })
    }

    @Test fun variants_dedupe_same_language_keeps_higher_score() {
        val items = listOf(
            mb("Sholay", "1975", "3h 24m", "8.1", id = "H1"),
            mb("Sholay [Hindi]", "1975", "3h 24m", "8.1", id = "H2"),
            mb("Sholay [Hindi]", "1975", "30m", "3.0", id = "H3"), // worse duration
        )
        val v = MovieBoxMatcher.pickVariants(ref("Sholay", "1975", 204, 8.1), items)
        // exactly one Hindi entry, and it is the better-scoring one (not H3)
        assertEquals(1, v.count { it.language == "Hindi" })
        assertFalse(v.any { it.item.subjectId == "H3" })
    }

    @Test fun variants_cap_at_max() {
        val items = (1..8).map { mb("Big Movie [Lang$it]", "2020", "2h", "7.0", id = "L$it") } +
            mb("Big Movie", "2020", "2h", "7.0", id = "O")
        val v = MovieBoxMatcher.pickVariants(ref("Big Movie", "2020", 120, 7.0), items, maxVariants = 4)
        assertEquals(4, v.size)
        assertTrue(v[0].isOriginal) // original still leads
    }

    @Test fun variants_empty_when_no_anchor() {
        val v = MovieBoxMatcher.pickVariants(ref("Inception", "2010"), listOf(mb("Totally Different", "1990")))
        assertTrue(v.isEmpty())
    }

    // ============================ DATA-DRIVEN BREADTH =======================
    // Bulk cases to push coverage past 100 assertions and lock general behaviour.

    @Test fun bulk_exact_title_year_matches() {
        // 25 (title, year, runtime, vote) tuples that must each self-match.
        val titles = listOf(
            Triple("The Dark Knight", "2008", 152), Triple("Interstellar", "2014", 169),
            Triple("Gladiator", "2000", 155), Triple("Titanic", "1997", 195),
            Triple("Avatar", "2009", 162), Triple("Joker", "2019", 122),
            Triple("Whiplash", "2014", 106), Triple("Drishyam", "2015", 163),
            Triple("Dangal", "2016", 161), Triple("PK", "2014", 153),
            Triple("Sholay", "1975", 204), Triple("Bahubali", "2015", 159),
            Triple("KGF", "2018", 156), Triple("Vikram", "2022", 174),
            Triple("Jawan", "2023", 169), Triple("Animal", "2023", 201),
            Triple("Stree", "2018", 128), Triple("Andhadhun", "2018", 139),
            Triple("Lagaan", "2001", 224), Triple("Swades", "2004", 195),
            Triple("Rang De Basanti", "2006", 167), Triple("Zindagi Na Milegi Dobara", "2011", 155),
            Triple("Queen", "2013", 146), Triple("Barfi", "2012", 151),
            Triple("Tumbbad", "2018", 104),
        )
        for ((t, y, rt) in titles) {
            val m = MovieBoxMatcher.pickBestMatch(ref(t, y, rt, 7.5), listOf(mb(t, y, "${rt / 60}h ${rt % 60}m", "7.5")))
            assertNotNull("self-match failed for $t", m)
            assertEquals(t, m!!.item.title)
        }
    }

    @Test fun bulk_dub_grouping_across_languages() {
        // For 10 titles, an Original + Hindi + Tamil triplet must group into 3,
        // Original-first, regardless of bracket spacing.
        val titles = listOf("Leo", "Master", "Beast", "Kabir Singh", "Padmaavat",
            "Sanju", "Uri", "Gully Boy", "War", "Tiger Zinda Hai")
        for (t in titles) {
            val items = listOf(
                mb("$t [Tamil]", "2020", "2h 30m", "7.5", id = "$t-T"),
                mb(t, "2020", "2h 30m", "7.5", id = "$t-O"),
                mb("$t [Hindi]", "2020", "2h 30m", "7.5", id = "$t-H"),
            )
            val v = MovieBoxMatcher.pickVariants(ref(t, "2020", 150, 7.5), items)
            assertEquals("grouping failed for $t", 3, v.size)
            assertTrue("original not first for $t", v[0].isOriginal)
        }
    }

    @Test fun bulk_unrelated_titles_never_match() {
        val unrelated = listOf("Cars", "Up", "Coco", "Soul", "Brave", "Luca",
            "Frozen", "Tangled", "Moana", "Encanto")
        for (u in unrelated) {
            assertNull("must not match $u to Inception", MovieBoxMatcher.pickBestMatch(ref("Inception", "2010", 148, 8.4), listOf(mb(u, "2015", "1h 40m", "7.0"))))
        }
    }
}
