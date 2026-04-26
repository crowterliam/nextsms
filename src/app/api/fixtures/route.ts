import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getFixtures, createFixtures, deleteFixtures, getTeams } from '@/lib/db';
import { generateFixtures } from '@/lib/fixtures';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'edge';

export async function GET() {
  const env = getEnv();
  const result = await getFixtures(env.DB, 1);
  return NextResponse.json(result.results);
}

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();
  const season = body.season || 1;

  await deleteFixtures(env.DB, season);

  const teams = await getTeams(env.DB);
  if (!teams.results || teams.results.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 });
  }

  const teamIds = (teams.results as Array<{ id: number }>).map((t) => t.id);
  const rounds = generateFixtures(teamIds);

  await createFixtures(env.DB, season, rounds);

  return NextResponse.json({ success: true, rounds: rounds.length, matches: rounds.reduce((acc, r) => acc + r.matches.length, 0) });
}
