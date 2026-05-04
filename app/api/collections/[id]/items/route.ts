export const runtime = 'edge';

import { collectionItems } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const addItemSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'series']),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const items = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, id))
    .orderBy(collectionItems.sortOrder)
    .all();

  return NextResponse.json({ ok: true, data: items });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  await db
    .insert(collectionItems)
    .values({ collectionId: id, ...parsed.data })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, data: null }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { id } = await params;
  const { tmdbId, mediaType } = await req.json().catch(() => ({}));
  if (!tmdbId || !mediaType) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, id),
        eq(collectionItems.tmdbId, tmdbId),
        eq(collectionItems.mediaType, mediaType),
      ),
    );

  return NextResponse.json({ ok: true, data: null });
}
