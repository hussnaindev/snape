import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when `fetch` was aborted via `AbortSignal` (browser / Node). */
export function isAbortError(e: unknown): boolean {
  if (e instanceof Error && e.name === 'AbortError') return true;
  return (
    typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError'
  );
}
