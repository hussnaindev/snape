export const runtime = 'edge';

import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthenticated', code: 401 }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data: user });
}
