import * as schema from '@/db/schema';

export type AppDb = import('drizzle-orm/d1').DrizzleD1Database<typeof schema>;

export async function getDb(): Promise<AppDb> {
  const { getRequestContext } = await import('@cloudflare/next-on-pages');
  const { env } = getRequestContext();
  const { drizzle } = await import('drizzle-orm/d1');
  return drizzle(env.DB, { schema });
}
