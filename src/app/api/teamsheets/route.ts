import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getPlayers } from '@/lib/db';
import { createTeamsheet, teamsheetToLineup } from '@/lib/teamsheet-creator';
import type { Player } from '@/lib/types';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();
  const { team_id, formation } = body as { team_id: number; formation: string };

  if (typeof team_id !== 'number' || team_id <= 0 || !formation) {
    return NextResponse.json({ error: 'team_id and formation required (e.g. "442N")' }, { status: 400 });
  }

  const result = await getPlayers(env.DB, team_id);
  if (!result.results || result.results.length === 0) {
    return NextResponse.json({ error: 'No players found for team' }, { status: 404 });
  }

  const roster = result.results as Player[];
  const sheet = createTeamsheet(roster, formation, '', 5);
  const { lineup, penalty_taker } = teamsheetToLineup(sheet);

  return NextResponse.json({
    tactic: sheet.tactic,
    lineup,
    penalty_taker,
    starting: sheet.starting.map((s) => ({ position: s.position, name: s.player.name })),
    subs: sheet.subs.map((s) => ({ position: s.position, name: s.player.name })),
  });
}
