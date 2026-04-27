import { WatchHistoryRecorder } from '@/components/watch-history-recorder';
import { getMovieDetail } from '@/lib/tmdb';
import { getMovieEmbedUrl } from '@/lib/vsembed';
import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import { WatchControls } from './watch-controls';

export const runtime = 'edge';

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
  const movie = await getMovieDetail(movieId).catch(() => null);

  return (
    <div className="fixed inset-0 bg-black">
      <div className="absolute inset-0 player-safe-area">
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

      {movie && (
        <WatchHistoryRecorder
          id={movieId}
          type="movie"
          title={movie.title}
          posterPath={movie.poster_path}
          backdropPath={movie.backdrop_path}
          year={movie.release_date?.slice(0, 4) ?? ''}
        />
      )}
    </div>
  );
}
