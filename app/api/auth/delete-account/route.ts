import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { passwords, users } from '@/db/schema';
import { verifyPassword } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import { SESSION_COOKIE, getSession } from '@/lib/session';

const schema = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });

  const db = await getDb();
  const pw = await db
    .select({ hash: passwords.hash })
    .from(passwords)
    .where(eq(passwords.userId, session.id))
    .get();

  if (!pw || !(await verifyPassword(parsed.data.password, pw.hash))) {
    return NextResponse.json(
      { ok: false, error: 'Incorrect password', code: 401 },
      { status: 401 },
    );
  }

  // Deleting the user cascades to passwords, sessions, profiles, watchlist, watch_history, preferences
  await db.delete(users).where(eq(users.id, session.id));

  const res = NextResponse.json({ ok: true, data: null });
  res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' });
  return res;
}
