export const runtime = 'edge';

import { passwords, profiles, users } from '@/db/schema';
import { verifyPassword } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import { createSession, sessionCookieOptions } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password', code: 400 },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const db = await getDb();

  const user = await db
    .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password', code: 401 },
      { status: 401 },
    );
  }

  const pw = await db
    .select({ hash: passwords.hash })
    .from(passwords)
    .where(eq(passwords.userId, user.id))
    .get();
  if (!pw || !(await verifyPassword(password, pw.hash))) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password', code: 401 },
      { status: 401 },
    );
  }

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .get();

  const token = await createSession(user.id);
  const res = NextResponse.json({
    ok: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      profileId: profile?.id ?? '',
    },
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
