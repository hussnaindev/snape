export const runtime = 'edge';

import { passwords } from '@/db/schema';
import { hashPassword } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(passwords).set({ hash: newHash }).where(eq(passwords.userId, session.id));

  return NextResponse.json({ ok: true, data: null });
}
