import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getMovieEmbedUrl } from '@/lib/vsembed';
import { WatchControls } from './watch-controls';

// Extend the viewport to the full screen (including under the status bar) so
// that Chrome Android fullscreen mode fills edge-to-edge. The safe-area insets
// in the iframe container then account for the status-bar overlay height;
// those insets are zeroed in CSS when the document is actually in fullscreen.
export const viewport: Viewport = {
  viewportFit: 'cover',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) notFound();

  const embedUrl = getMovieEmbedUrl(movieId);

  return (
    <div className="fixed inset-0 bg-black">
      {/*
        Iframe fills the entire viewport. Safe-area insets push it away from
        notches, camera cutouts, and the iOS home indicator so the player's
        own control bar is never hidden behind system UI.
      */}
      <div
        className="absolute inset-0 player-safe-area"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/*
          No sandbox: vidsrc.icu's play button calls window.open() internally
          (ad + video start in one gesture). Sandboxing without allow-popups
          blocks that call and breaks playback entirely. The browser's built-in
          popup blocker (especially strong in Firefox) handles unwanted windows.
        */}
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
          title="Video player"
        />
      </div>

      {/* Back button (top-left) + fullscreen toggle (top-right, mobile only).
          Both live in WatchControls so they share orientation/fullscreen state
          and the back button can call router.back() to pop history correctly. */}
      <WatchControls />
    </div>
  );
}
