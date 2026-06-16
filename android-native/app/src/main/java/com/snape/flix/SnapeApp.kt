package com.snape.flix

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.SvgDecoder
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.util.DebugLogger
import com.snape.flix.data.Downloads
import com.snape.flix.data.LocalStore

/**
 * App-wide Coil configuration. The home screen scrolls through eight full-width
 * TMDB backdrops plus dozens of posters, so the default loader's behaviour costs
 * real frames while flinging:
 *
 *  • crossfade OFF — the default 100ms fade re-invalidates every newly-decoded
 *    image for several frames; with a fast fling that's continuous redraw churn.
 *    Cached images should just appear.
 *  • bitmapConfig left at Coil's default (HARDWARE on API 26+) — hardware bitmaps
 *    live in GPU memory and are sampled directly while scrolling with no per-frame
 *    CPU→GPU texture upload. (We previously forced RGB_565, but that produces
 *    *software* bitmaps the render thread must re-upload as they scroll into view
 *    — the opposite of what an image-heavy scroller wants — so it's removed.)
 *  • generous in-memory + on-disk caches so scrolling back up is a cache hit and
 *    never re-decodes/re-downloads.
 *
 * Registering the SvgDecoder here also means the bundled vector provider logos
 * load through this same tuned loader.
 */
class SnapeApp : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        // Local-only persistence (watchlist + watch history) — no external DB.
        LocalStore.init(this)
        // Offline downloads store + engine (resumes paused rows after a restart).
        Downloads.init(this)
    }

    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .crossfade(false)
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
