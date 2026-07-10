/** Standard API envelope used by all route handlers. */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; code: number };
