package com.snape.flix.data

import android.app.Notification
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Scheduler
import com.snape.flix.R

/**
 * The Media3 foreground service that runs offline downloads (progressive / DASH /
 * HLS). It keeps the download process alive and shows a progress notification; the
 * actual queue + persistence lives in [Downloads].
 */
@OptIn(UnstableApi::class)
class SnapeDownloadService : DownloadService(
    /* foregroundNotificationId = */ 1001,
    DownloadService.DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
    Downloads.CHANNEL_ID,
    R.string.download_channel_name,
    /* channelDescriptionResourceId = */ 0,
) {
    override fun getDownloadManager(): DownloadManager = Downloads.downloadManager(this)

    override fun getScheduler(): Scheduler? = null

    override fun getForegroundNotification(downloads: MutableList<Download>, notMetRequirements: Int): Notification =
        Downloads.buildForegroundNotification(this, downloads, notMetRequirements)
}
