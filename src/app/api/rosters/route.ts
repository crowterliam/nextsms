import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { createPlayersBatch } from '@/lib/db';
import { generateRoster } from '@/lib/roster-creator';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();
  const { team_id } = body;

  if (typeof team_id !== 'number' || team_id <= 0) return NextResponse.json({ error: 'team_id required' }, { status: 400 });

  const roster = generateRoster(body.config || {});
  const playerRecords = roster.players.map((p) => ({
    team_id,
    name: p.name,
    age: p.age,
    nationality: p.nationality,
    pref_side: p.pref_side,
    st: p.st,
    tk: p.tk,
    ps: p.ps,
    sh: p.sh,
    sm: p.sm,
    ag: p.ag,
  }));

  await createPlayersBatch(env.DB, playerRecords);
  return NextResponse.json({ success: true, count: playerRecords.length });
}
