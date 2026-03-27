import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    ok: true,
    data: { status: 'healthy', timestamp: new Date().toISOString() },
  });
}
