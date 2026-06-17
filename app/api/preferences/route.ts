export const runtime = 'edge';

import { preferences } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  autoplayNext: z.boolean().optional(),
  subtitlesEnabled: z.boolean().optional(),
  subtitlesLanguage: z.string().min(2).max(10).optional(),
  contentMaturity: z.enum(['all', 'teen', 'kids']).optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const db = await getDb();
  const prefs = await db
    .select()
    .from(preferences)
    .where(eq(preferences.profileId, session.profileId))
    .get();

  return NextResponse.json({ ok: true, data: prefs });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 400 },
      { status: 400 },
    );
  }

  const db = await getDb();
  const updates = { ...parsed.data, updatedAt: new Date() };

  await db.update(preferences).set(updates).where(eq(preferences.profileId, session.profileId));

  const updated = await db
    .select()
    .from(preferences)
    .where(eq(preferences.profileId, session.profileId))
    .get();

  return NextResponse.json({ ok: true, data: updated });
}
