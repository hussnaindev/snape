import { profiles, sessions, users } from '@/db/schema';
import { generateToken } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'session_token';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  profileId: string;
};

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const db = await getDb();
    const row = await db
      .select({
        userId: sessions.userId,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        expiresAt: sessions.expiresAt,
        profileId: profiles.id,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .innerJoin(profiles, and(eq(profiles.userId, users.id), eq(profiles.isDefault, true)))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .get();

    if (!row) return null;

    return {
      id: row.userId,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl ?? null,
      profileId: row.profileId,
    };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = await getDb();
  await db.insert(sessions).values({ token, userId, expiresAt });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  };
}
