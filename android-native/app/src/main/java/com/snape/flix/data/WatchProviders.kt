package com.snape.flix.data

/**
 * The six "preferred" streaming providers the web detail page surfaces, in the
 * same fixed display order. Mirrors `lib/watch-providers.ts`. [asset] points at a
 * bundled white-able SVG in `assets/providers/`.
 */
enum class WatchProviderKey(
    val label: String,
    val asset: String,
    val tmdbId: Int,
    val brandColor: Long,
    val heroId: Int,
    val heroIsSeries: Boolean,
) {
    NETFLIX("Netflix", "file:///android_asset/providers/netflix.svg", 8, 0xFFE50914, 66732, true),
    MAX("Max", "file:///android_asset/providers/max.svg", 1899, 0xFF8A2BE2, 94997, true),
    PRIMEVIDEO("Prime Video", "file:///android_asset/providers/primevideo.svg", 9, 0xFF00A8E0, 76479, true),
    DISNEYPLUS("Disney+", "file:///android_asset/providers/disneyplus.svg", 337, 0xFF166534, 84958, true),
    PARAMOUNTPLUS("Paramount+", "file:///android_asset/providers/paramountplus.svg", 531, 0xFFCA8A04, 73586, true),
    APPLETV("Apple TV+", "file:///android_asset/providers/appletv.svg", 350, 0xFF6E6E73, 438631, false);

    /** Netflix & Max wordmarks read smaller than the others, like the web sizing. */
    val isWide: Boolean get() = this == NETFLIX || this == MAX
}

private fun normalize(name: String): String =
    name.lowercase().replace("+", "plus").replace(Regex("[^a-z0-9]+"), " ").trim()

private fun keyFor(name: String): WatchProviderKey? {
    val n = normalize(name)
    return when {
        n.contains("netflix") -> WatchProviderKey.NETFLIX
        n.contains("prime video") || n.contains("amazon prime") -> WatchProviderKey.PRIMEVIDEO
        n.contains("paramount") -> WatchProviderKey.PARAMOUNTPLUS
        n.contains("apple tv") -> WatchProviderKey.APPLETV
        n == "max" || n.contains("hbo max") || (n.contains("max") && !n.contains("imax")) -> WatchProviderKey.MAX
        n.contains("disney") -> WatchProviderKey.DISNEYPLUS
        else -> null
    }
}

/** Pick the preferred providers present in one region, in fixed order (Apple TV+ last). */
fun pickProviders(region: TmdbProviderRegion?): List<WatchProviderKey> {
    if (region == null) return emptyList()
    val found = LinkedHashSet<WatchProviderKey>()
    listOfNotNull(region.flatrate, region.free, region.ads, region.rent, region.buy)
        .flatten()
        .forEach { p -> keyFor(p.provider_name)?.let { found.add(it) } }

    val ordered = WatchProviderKey.entries.filter { it in found }.toMutableList()
    if (ordered.size > 1 && ordered.remove(WatchProviderKey.APPLETV)) {
        ordered.add(WatchProviderKey.APPLETV)
    }
    return ordered
}
