/** Standard API envelope used by all route handlers. */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; code: number };

/** Utility: make specific keys of T required. */
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Utility: make specific keys of T optional. */
export type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
