export const runtime = 'edge';

import { watchlist } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';


const addSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'series', 'collection']),
});

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const db = await getDb();
  const items = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.profileId, session.profileId))
    .orderBy(desc(watchlist.addedAt))
    .all();

  return NextResponse.json({ ok: true, data: items });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  // For collections, just store the collection ID (not all movies)
  const db = await getDb();
  await db
    .insert(watchlist)
    .values({ profileId: session.profileId, ...parsed.data })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, data: null }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { tmdbId, mediaType } = await req.json().catch(() => ({}));
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  await db
    .delete(watchlist)
    .where(
      and(
        eq(watchlist.profileId, session.profileId),
        eq(watchlist.tmdbId, tmdbId),
        eq(watchlist.mediaType, mediaType),
      ),
    );

  return NextResponse.json({ ok: true, data: null });
}
