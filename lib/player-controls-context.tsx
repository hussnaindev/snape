'use client';

import { createContext, useContext, useState } from 'react';

export interface PlayerTopbarControls {
  isFullscreen: boolean;
  onFullscreen: () => void;
  onEpisodes?: () => void;
}

interface ContextValue {
  controls: PlayerTopbarControls | null;
  setControls: (v: PlayerTopbarControls | null) => void;
}

const PlayerControlsContext = createContext<ContextValue>({
  controls: null,
  setControls: () => {},
});

export function PlayerControlsProvider({ children }: { children: React.ReactNode }) {
  const [controls, setControls] = useState<PlayerTopbarControls | null>(null);
  return (
    <PlayerControlsContext.Provider value={{ controls, setControls }}>
      {children}
    </PlayerControlsContext.Provider>
  );
}

export function usePlayerControls() {
  return useContext(PlayerControlsContext);
}
