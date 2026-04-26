import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getMatch } from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const env = getEnv();
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (isNaN(matchId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const match = await getMatch(env.DB, matchId);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  return NextResponse.json(match);
}
