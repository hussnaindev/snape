export const runtime = 'edge';

import { watchHistory } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { and, desc, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Entries untouched for this long are pruned (mirrors the client). 0 season /
// episode means "movie" (or whole-title), so the per-episode unique key holds.
const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ROWS = 200;

const upsertSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'series']),
  title: z.string().min(1).max(300),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
  year: z.string().max(4).default(''),
  progress: z.number().min(0).max(100).default(0),
  positionSeconds: z.number().int().min(0).default(0),
  durationSeconds: z.number().int().min(0).default(0),
  season: z.number().int().min(0).default(0),
  episode: z.number().int().min(0).default(0),
});

const bulkUpsertSchema = z.object({
  entries: z.array(upsertSchema).min(1).max(MAX_ROWS),
});

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const db = await getDb();

  // Prune stale rows (untouched for two weeks) before reading.
  await db
    .delete(watchHistory)
    .where(
      and(
        eq(watchHistory.profileId, session.profileId),
        lt(watchHistory.watchedAt, new Date(Date.now() - STALE_MS)),
      ),
    );

  const items = await db
    .select()
    .from(watchHistory)
    .where(eq(watchHistory.profileId, session.profileId))
    .orderBy(desc(watchHistory.watchedAt))
    .limit(MAX_ROWS)
    .all();

  return NextResponse.json({ ok: true, data: items });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);

  // Check for bulk sync
  const bulkParsed = bulkUpsertSchema.safeParse(body);
  if (bulkParsed.success) {
    const db = await getDb();
    const now = new Date();
    for (const entry of bulkParsed.data.entries) {
      await db
        .insert(watchHistory)
        .values({ profileId: session.profileId, ...entry, watchedAt: now })
        .onConflictDoUpdate({
          target: [
            watchHistory.profileId,
            watchHistory.tmdbId,
            watchHistory.mediaType,
            watchHistory.season,
            watchHistory.episode,
          ],
          set: {
            title: entry.title,
            posterPath: entry.posterPath ?? null,
            backdropPath: entry.backdropPath ?? null,
            year: entry.year,
            progress: entry.progress,
            positionSeconds: entry.positionSeconds,
            durationSeconds: entry.durationSeconds,
            watchedAt: now,
          },
        });
    }
    return NextResponse.json({ ok: true, data: null });
  }

  // Single entry upsert
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  await db
    .insert(watchHistory)
    .values({ profileId: session.profileId, ...parsed.data, watchedAt: new Date() })
    .onConflictDoUpdate({
      target: [
        watchHistory.profileId,
        watchHistory.tmdbId,
        watchHistory.mediaType,
        watchHistory.season,
        watchHistory.episode,
      ],
      set: {
        title: parsed.data.title,
        posterPath: parsed.data.posterPath ?? null,
        backdropPath: parsed.data.backdropPath ?? null,
        year: parsed.data.year,
        progress: parsed.data.progress,
        positionSeconds: parsed.data.positionSeconds,
        durationSeconds: parsed.data.durationSeconds,
        watchedAt: new Date(),
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
