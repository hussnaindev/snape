export const runtime = 'edge';

import { watchHistory } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';


const upsertSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'series']),
  title: z.string().min(1).max(300),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
  year: z.string().max(4).default(''),
  progress: z.number().min(0).max(100).default(0),
  season: z.number().int().positive().nullable().optional(),
  episode: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const db = await getDb();
  const items = await db
    .select()
    .from(watchHistory)
    .where(eq(watchHistory.profileId, session.profileId))
    .orderBy(desc(watchHistory.watchedAt))
    .limit(20)
    .all();

  return NextResponse.json({ ok: true, data: items });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  await db
    .insert(watchHistory)
    .values({ profileId: session.profileId, ...parsed.data, watchedAt: new Date() })
    .onConflictDoUpdate({
      target: [watchHistory.profileId, watchHistory.tmdbId, watchHistory.mediaType],
      set: {
        progress: parsed.data.progress,
        watchedAt: new Date(),
        season: parsed.data.season ?? null,
        episode: parsed.data.episode ?? null,
      },
    });

  return NextResponse.json({ ok: true, data: null });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const db = await getDb();

  if (body && typeof body === 'object' && body.all === true) {
    await db.delete(watchHistory).where(eq(watchHistory.profileId, session.profileId));
    return NextResponse.json({ ok: true, data: null });
  }

  const { tmdbId, mediaType } = body as { tmdbId?: number; mediaType?: 'movie' | 'series' };
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  await db
    .delete(watchHistory)
    .where(
      and(
        eq(watchHistory.profileId, session.profileId),
        eq(watchHistory.tmdbId, tmdbId),
        eq(watchHistory.mediaType, mediaType),
      ),
    );

  return NextResponse.json({ ok: true, data: null });
}
