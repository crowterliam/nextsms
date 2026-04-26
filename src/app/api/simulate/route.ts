import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getTeam, getPlayers } from '@/lib/db';
import { createTeamsheet, teamsheetToLineup } from '@/lib/teamsheet-creator';
import { simulateMatch } from '@/lib/simulator';
import { DEFAULT_CONFIG } from '@/lib/types';
import type { Player } from '@/lib/types';
import { requireAuth } from '@/lib/auth-helpers';

interface TeamRow {
  id: number;
  name: string;
  abbreviation: string;
}

export const runtime = 'edge';

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();
  const { home_team_id, away_team_id, seed } = body as Record<string, unknown>;

  if (typeof home_team_id !== 'number' || home_team_id <= 0 || typeof away_team_id !== 'number' || away_team_id <= 0) {
    return NextResponse.json({ error: 'Select both teams' }, { status: 400 });
  }

  const homeTeamId = home_team_id as number;
  const awayTeamId = away_team_id as number;

  const homePlayersResult = await getPlayers(env.DB, homeTeamId);
  const awayPlayersResult = await getPlayers(env.DB, awayTeamId);

  if (!homePlayersResult.results?.length || !awayPlayersResult.results?.length) {
    return NextResponse.json({ error: 'Both teams need players' }, { status: 400 });
  }

  const homeRoster = homePlayersResult.results as Player[];
  const awayRoster = awayPlayersResult.results as Player[];

  const homeFormation = (body.home_formation as string) || '442N';
  const awayFormation = (body.away_formation as string) || '442N';

  const homeSheet = createTeamsheet(homeRoster, homeFormation, '', 5);
  const awaySheet = createTeamsheet(awayRoster, awayFormation, '', 5);

  const homeLineupData = teamsheetToLineup(homeSheet);
  const awayLineupData = teamsheetToLineup(awaySheet);

  const homeTeam: TeamRow | null = await getTeam(env.DB, homeTeamId) as TeamRow | null;
  const awayTeam: TeamRow | null = await getTeam(env.DB, awayTeamId) as TeamRow | null;

  const matchResult = simulateMatch(
    homeRoster,
    awayRoster,
    homeLineupData.lineup,
    awayLineupData.lineup,
    homeSheet.tactic,
    awaySheet.tactic,
    homeTeam?.name || 'Home',
    awayTeam?.name || 'Away',
    [],
    [],
    homeLineupData.penalty_taker,
    awayLineupData.penalty_taker,
    DEFAULT_CONFIG,
    seed ? parseInt(seed as string, 10) : undefined
  );

  return NextResponse.json({
    home_score: matchResult.home_score,
    away_score: matchResult.away_score,
    events: matchResult.events,
    commentary: matchResult.commentary,
    penalties: matchResult.penalties,
    home_tactic: homeSheet.tactic,
    away_tactic: awaySheet.tactic,
    home_starting: homeSheet.starting.map((s) => ({ position: s.position, name: s.player.name })),
    away_starting: awaySheet.starting.map((s) => ({ position: s.position, name: s.player.name })),
    home_stats: matchResult.home_stats.filter((p: { active: number; injured: number }) => p.active === 1 || p.injured > 0).map((p: { name: string; pos: string; goals: number; assists: number; shots: number; shots_on: number; tackles: number; saves: number; keypasses: number; yellowcards: number; redcards: number; minutes: number }) => ({
      name: p.name, pos: p.pos, goals: p.goals, assists: p.assists,
      shots: p.shots, shots_on: p.shots_on, tackles: p.tackles,
      saves: p.saves, keypasses: p.keypasses, yellowcards: p.yellowcards,
      redcards: p.redcards, rating: playerRating(p),
    })),
    away_stats: matchResult.away_stats.filter((p: { active: number; injured: number }) => p.active === 1 || p.injured > 0).map((p: { name: string; pos: string; goals: number; assists: number; shots: number; shots_on: number; tackles: number; saves: number; keypasses: number; yellowcards: number; redcards: number; minutes: number }) => ({
      name: p.name, pos: p.pos, goals: p.goals, assists: p.assists,
      shots: p.shots, shots_on: p.shots_on, tackles: p.tackles,
      saves: p.saves, keypasses: p.keypasses, yellowcards: p.yellowcards,
      redcards: p.redcards, rating: playerRating(p),
    })),
  });
}

function playerRating(p: { goals: number; assists: number; shots_on: number; tackles: number; saves: number; keypasses: number; yellowcards: number; redcards: number; minutes: number }): number {
  if (p.minutes === 0) return 0;
  const raw = p.goals * 9 + p.assists * 7 + p.shots_on + p.tackles * 6 + p.saves * 3 + p.keypasses * 4 - p.yellowcards * 2 - p.redcards * 5;
  return Math.max(1, Math.min(10, Math.round(5 + raw * 0.3)));
}
