import * as schema from '@/db/schema';

export type AppDb = import('drizzle-orm/d1').DrizzleD1Database<typeof schema>;

let _localDb: AppDb | null = null;

export async function getDb(): Promise<AppDb> {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const { env } = getRequestContext();
    if (env.DB) {
      const { drizzle } = await import('drizzle-orm/d1');
      return drizzle(env.DB, { schema });
    }
  } catch {
    // Not in CF Workers context — fall through to local dev
  }

  if (!_localDb) {
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    const sqlite = new Database('./local.db', { create: true });
    _localDb = drizzle(sqlite, { schema }) as unknown as AppDb;
  }
  return _localDb;
}
