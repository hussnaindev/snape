import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMovieEmbedUrl } from '@/lib/vsembed';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) notFound();

  const embedUrl = getMovieEmbedUrl(movieId);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/*
        Iframe fills the entire viewport. Bottom padding keeps the player's
        own control bar above the iOS home indicator. Top/sides use insets
        so content isn't hidden behind notches or camera cutouts.
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
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
          title="Video player"
        />
      </div>

      {/*
        Back button sits above the iframe using z-index.
        CSS max() ensures it clears the status bar on notched devices
        without blocking anything when there is no notch (falls back to 12px).
      */}
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
    </div>
  );
}
