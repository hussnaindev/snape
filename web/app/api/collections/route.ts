export const runtime = 'edge';

import { collectionItems, collections } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { and, count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const db = await getDb();
  const items = await db
    .select()
    .from(collections)
    .where(eq(collections.profileId, session.profileId))
    .orderBy(desc(collections.updatedAt))
    .all();

  return NextResponse.json({ ok: true, data: items });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid input', code: 400 }, { status: 400 });
  }

  const db = await getDb();
  const [collection] = await db
    .insert(collections)
    .values({ profileId: session.profileId, ...parsed.data })
    .returning();

  return NextResponse.json({ ok: true, data: collection }, { status: 201 });
}
