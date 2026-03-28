'use client';

import { PlayerModal } from '@/components/player-modal';
import { QualitySelector } from '@/components/quality-selector';
import type { ParsedStream, StreamQuality } from '@/types/torrentio';
import { useState } from 'react';

interface WatchButtonsProps {
  streams: ParsedStream[];
  streamGroups: Partial<Record<StreamQuality, ParsedStream[]>>;
}

export function WatchButtons({ streams, streamGroups }: WatchButtonsProps) {
  const [showQuality, setShowQuality] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<StreamQuality | null>(null);
  const [activeStream, setActiveStream] = useState<ParsedStream | null>(null);

  const hasStreams = streams.length > 0;

  function handleWatchClick() {
    if (!hasStreams) return;
    setShowQuality((prev) => !prev);
  }

  function handleQualitySelect(quality: StreamQuality) {
    setSelectedQuality(quality);
    const best = streamGroups[quality]?.[0];
    if (best) {
      setActiveStream(best);
      setShowQuality(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 flex-wrap">
          {hasStreams ? (
            <button
              type="button"
              onClick={handleWatchClick}
              className="inline-flex items-center gap-2 bg-sage text-black font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-sage/90 transition-colors"
            >
              <span>▶</span> Watch
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 bg-white/5 text-white/30 font-semibold text-sm px-6 py-2.5 rounded-full border border-white/10 cursor-not-allowed">
              Streaming Unavailable
            </span>
          )}
        </div>

        {showQuality && (
          <div className="animate-fade-in">
            <QualitySelector
              groups={streamGroups}
              selected={selectedQuality}
              onSelect={handleQualitySelect}
            />
          </div>
        )}
      </div>

      {activeStream && <PlayerModal stream={activeStream} onClose={() => setActiveStream(null)} />}
    </>
  );
}
