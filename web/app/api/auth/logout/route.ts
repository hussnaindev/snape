export const runtime = 'edge';

import { SESSION_COOKIE, deleteSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const res = NextResponse.json({ ok: true, data: null });
  res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' });
  return res;
}
