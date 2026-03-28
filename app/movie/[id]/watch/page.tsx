import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMovieEmbedUrl } from '@/lib/vsembed';
import { WatchControls } from './watch-controls';

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
        className="absolute inset-0"
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

      {/* Back — top-left, clears notch/status-bar via CSS max() */}
      <Link
        href={`/movie/${movieId}`}
        className="absolute z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 text-white text-lg"
        style={{
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'max(12px, env(safe-area-inset-left))',
        }}
        aria-label="Back"
      >
        ←
      </Link>

      {/* Fullscreen + landscape toggle — top-right, mobile only */}
      <WatchControls />
    </div>
  );
}
