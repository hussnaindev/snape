import type { ApiResponse } from '@/types';

/**
 * Typed fetch wrapper for internal API routes.
 * For client components, pass the full path (e.g. '/api/health').
 * Set NEXT_PUBLIC_API_URL for cross-origin API calls.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';

  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const json = (await res.json()) as ApiResponse<T>;
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      code: 500,
    };
  }
}
