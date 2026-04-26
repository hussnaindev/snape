export const runtime = 'edge';

import { profiles, users } from '@/db/schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const presetAvatars = [
  '/avatar1.png',
  '/avatar2.png',
  '/avatar3.png',
  '/avatar4.png',
  '/avatar5.png',
] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  // Accepts preset avatars, HTTPS URLs (future CDN), or base64 data URLs from the client-side resizer
  avatarUrl: z
    .union([
      z.enum(presetAvatars),
      z.string().url().max(500),
      z
        .string()
        .regex(/^data:image\/(jpeg|png|webp);base64,/)
        .max(150_000),
      z.null(),
    ])
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });

  const db = await getDb();
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .get();

  if (!user)
    return NextResponse.json({ ok: false, error: 'Not found', code: 404 }, { status: 404 });
  return NextResponse.json({ ok: true, data: user });
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
  const { name, avatarUrl } = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  await db.update(users).set(updates).where(eq(users.id, session.id));

  // Keep default profile name in sync
  if (name !== undefined) {
    await db.update(profiles).set({ name }).where(eq(profiles.userId, session.id));
  }

  const updated = await db
    .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.id))
    .get();

  return NextResponse.json({ ok: true, data: updated });
}
