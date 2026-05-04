export const runtime = 'edge';

import { collectionItems, collections } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.profileId, session.profileId)))
    .all();

  if (!collection)
    return NextResponse.json(
      { ok: false, error: 'Collection not found', code: 404 },
      { status: 404 },
    );

  const items = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, id))
    .orderBy(collectionItems.sortOrder, desc(collectionItems.addedAt))
    .all();

  return NextResponse.json({ ok: true, data: { ...collection, items } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  const [updated] = await db
    .update(collections)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(collections.id, id), eq(collections.profileId, session.profileId)))
    .returning();

  if (!updated)
    return NextResponse.json(
      { ok: false, error: 'Collection not found', code: 404 },
      { status: 404 },
    );

  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const result = await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.profileId, session.profileId)));

  return NextResponse.json({ ok: true, data: null });
}
