import { useSyncExternalStore } from 'react';

/** False on the server and during hydration; true only after the client has mounted. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
