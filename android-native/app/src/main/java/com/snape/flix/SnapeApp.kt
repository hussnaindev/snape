package com.snape.flix

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.util.DebugLogger

/**
 * App-wide Coil configuration. The home screen scrolls through eight full-width
 * TMDB backdrops plus dozens of posters, so the default loader's behaviour costs
 * real frames while flinging:
 *
 *  • crossfade OFF — the default 100ms fade re-invalidates every newly-decoded
 *    image for several frames; with a fast fling that's continuous redraw churn.
 *    Cached images should just appear.
 *  • RGB_565 — backdrops/posters are opaque, so 16-bit bitmaps halve the decode
 *    allocation + texture upload (the GC pauses from 32-bit bitmaps are a prime
 *    stutter source) with no visible quality loss on this artwork.
 *  • generous in-memory + on-disk caches so scrolling back up is a cache hit and
 *    never re-decodes/re-downloads.
 *
 * Registering the SvgDecoder here also means the bundled vector provider logos
 * load through this same tuned loader.
 */
class SnapeApp : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .crossfade(false)
            .allowRgb565(true)
            .respectCacheHeaders(false)
            .components { add(SvgDecoder.Factory()) }
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(256L * 1024 * 1024)
                    .build()
            }
            .apply { if (BuildConfig.DEBUG) logger(DebugLogger()) }
            .build()
}
