import { passwords, preferences, profiles, users } from '@/db/schema';
import { hashPassword } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import { createSession, sessionCookieOptions } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';


const schema = z.object({
  name: z.string().min(1).max(80).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 400 },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;
  const db = await getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    return NextResponse.json(
      { ok: false, error: 'An account with this email already exists', code: 409 },
      { status: 409 },
    );
  }

  const hash = await hashPassword(password);
  const userId = crypto.randomUUID();
  const profileId = crypto.randomUUID();

  await db.insert(users).values({ id: userId, email, name });
  await db.insert(passwords).values({ userId, hash });
  await db.insert(profiles).values({ id: profileId, userId, name, isDefault: true });
  await db.insert(preferences).values({ profileId });

  const token = await createSession(userId);
  const res = NextResponse.json({
    ok: true,
    data: { id: userId, email, name, avatarUrl: null, profileId },
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
