import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { createMatch, updateMatchResult, getMatch, getMatches, getTeam, getPlayers } from '@/lib/db';
import { simulateMatch } from '@/lib/simulator';
import { configToLeagueConfig } from '@/lib/config';
import type { Player, LineupPlayer, ConditionalInstruction, LeagueConfig } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/types';
import { requireAuth, parseJsonBody } from '@/lib/auth-helpers';

interface TeamRow {
  id: number;
  name: string;
  abbreviation: string;
}

export const runtime = 'edge';

export async function GET(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const result = await getMatches(env.DB, 100);
  return NextResponse.json(result.results);
}

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await parseJsonBody(request);

  if (body.action === 'simulate') {
    return handleSimulate(env, body);
  }

  const { home_team_id, away_team_id, home_tactic, away_tactic, home_lineup, away_lineup, home_conditionals, away_conditionals } = body;
  if (typeof home_team_id !== 'number' || home_team_id <= 0 || typeof away_team_id !== 'number' || away_team_id <= 0) {
    return NextResponse.json({ error: 'home_team_id and away_team_id required' }, { status: 400 });
  }

  const result = await createMatch(env.DB, {
    home_team_id,
    away_team_id,
    home_tactic: home_tactic || 'N',
    away_tactic: away_tactic || 'N',
    home_lineup: JSON.stringify(home_lineup || []),
    away_lineup: JSON.stringify(away_lineup || []),
    home_conditionals: JSON.stringify(home_conditionals || []),
    away_conditionals: JSON.stringify(away_conditionals || []),
  });

  return NextResponse.json({ success: true, match_id: result.meta.last_row_id });
}

async function handleSimulate(env: CloudflareEnv, body: Record<string, unknown>) {
  const matchId = body.match_id as number;
  if (!matchId) {
    return NextResponse.json({ error: 'match_id required for simulate action' }, { status: 400 });
  }

  const match: Record<string, unknown> | null = await getMatch(env.DB, matchId) as Record<string, unknown> | null;
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.status === 'played') return NextResponse.json({ error: 'Match already played' }, { status: 400 });

  const homeTeamId = match.home_team_id as number;
  const awayTeamId = match.away_team_id as number;

  const homeTeam: TeamRow | null = await getTeam(env.DB, homeTeamId) as TeamRow | null;
  const awayTeam: TeamRow | null = await getTeam(env.DB, awayTeamId) as TeamRow | null;
  if (!homeTeam || !awayTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const homePlayersResult = await getPlayers(env.DB, homeTeamId);
  const awayPlayersResult = await getPlayers(env.DB, awayTeamId);
  const homeRoster: Player[] = homePlayersResult.results as Player[];
  const awayRoster: Player[] = awayPlayersResult.results as Player[];

  const homeLineup: LineupPlayer[] = JSON.parse((match.home_lineup as string) || '[]');
  const awayLineup: LineupPlayer[] = JSON.parse((match.away_lineup as string) || '[]');
  const homeConds: ConditionalInstruction[] = JSON.parse((match.home_conditionals as string) || '[]');
  const awayConds: ConditionalInstruction[] = JSON.parse((match.away_conditionals as string) || '[]');

  let config: LeagueConfig = DEFAULT_CONFIG;
  try {
    const configRows = await env.DB.prepare('SELECT key, value FROM league_config').all();
    if (configRows.results && configRows.results.length > 0) {
      const configMap: Record<string, string> = {};
      for (const row of configRows.results as Array<Record<string, string>>) {
        configMap[row.key] = row.value;
      }
      config = configToLeagueConfig(configMap);
    }
  } catch { /* use defaults */ }

  const result = simulateMatch(
    homeRoster,
    awayRoster,
    homeLineup.length > 0 ? homeLineup : autoLineup(homeRoster),
    awayLineup.length > 0 ? awayLineup : autoLineup(awayRoster),
    (match.home_tactic as string) || 'N',
    (match.away_tactic as string) || 'N',
    homeTeam.name,
    awayTeam.name,
    homeConds,
    awayConds,
    null,
    null,
    config,
    body.seed ? parseInt(body.seed as string, 10) : undefined
  );

  await updateMatchResult(env.DB, matchId, {
    home_score: result.home_score,
    away_score: result.away_score,
    status: 'played',
    commentary: result.commentary,
    match_events: JSON.stringify(result.events),
    played_at: new Date().toISOString(),
  });

  for (const stat of result.home_stats) {
    const player = homeRoster.find((p) => p.id === stat.player_id);
    if (player) await applyPlayerStats(env, player, stat, config);
  }
  for (const stat of result.away_stats) {
    const player = awayRoster.find((p) => p.id === stat.player_id);
    if (player) await applyPlayerStats(env, player, stat, config);
  }

  try {
    await env.DB.prepare('INSERT OR IGNORE INTO league_table (team_id, season) VALUES (?, 1)').bind(homeTeamId).run();
    await env.DB.prepare('INSERT OR IGNORE INTO league_table (team_id, season) VALUES (?, 1)').bind(awayTeamId).run();

    if (result.home_score > result.away_score) {
      await env.DB.prepare(
        'UPDATE league_table SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE team_id = ? AND season = 1'
      ).bind(result.home_score, result.away_score, result.home_score - result.away_score, homeTeamId).run();
      await env.DB.prepare(
        'UPDATE league_table SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE team_id = ? AND season = 1'
      ).bind(result.away_score, result.home_score, result.away_score - result.home_score, awayTeamId).run();
    } else if (result.away_score > result.home_score) {
      await env.DB.prepare(
        'UPDATE league_table SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE team_id = ? AND season = 1'
      ).bind(result.away_score, result.home_score, result.away_score - result.home_score, awayTeamId).run();
      await env.DB.prepare(
        'UPDATE league_table SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE team_id = ? AND season = 1'
      ).bind(result.home_score, result.away_score, result.home_score - result.away_score, homeTeamId).run();
    } else {
      await env.DB.prepare(
        'UPDATE league_table SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE team_id = ? AND season = 1'
      ).bind(result.home_score, result.away_score, 0, homeTeamId).run();
      await env.DB.prepare(
        'UPDATE league_table SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE team_id = ? AND season = 1'
      ).bind(result.away_score, result.home_score, 0, awayTeamId).run();
    }
  } catch { /* league table update optional */ }

  return NextResponse.json({
    success: true,
    match_id: matchId,
    home_score: result.home_score,
    away_score: result.away_score,
    events: result.events,
    penalties: result.penalties,
  });
}

async function applyPlayerStats(env: CloudflareEnv, player: Player, stat: Record<string, number>, config: LeagueConfig) {
  const games = player.games + (stat.minutes > 0 ? 1 : 0);
  let st_ab = player.st_ab + (stat.st_ab || 0);
  let tk_ab = player.tk_ab + (stat.tk_ab || 0);
  let ps_ab = player.ps_ab + (stat.ps_ab || 0);
  let sh_ab = player.sh_ab + (stat.sh_ab || 0);
  let st = player.st;
  let tk = player.tk;
  let ps = player.ps;
  let sh = player.sh;

  if (st_ab >= 1000) { st++; st_ab -= 700; }
  if (tk_ab >= 1000) { tk++; tk_ab -= 700; }
  if (ps_ab >= 1000) { ps++; ps_ab -= 700; }
  if (sh_ab >= 1000) { sh++; sh_ab -= 700; }
  if (st_ab < 0) { st = Math.max(1, st - 1); st_ab += 300; }
  if (tk_ab < 0) { tk = Math.max(1, tk - 1); tk_ab += 300; }
  if (ps_ab < 0) { ps = Math.max(1, ps - 1); ps_ab += 300; }
  if (sh_ab < 0) { sh = Math.max(1, sh - 1); sh_ab += 300; }

  const injury = stat.injured > 0 ? stat.injured : player.injury;
  const dp = player.dp + (stat.yellowcards || 0) * config.dp_for_yellow + (stat.redcards || 0) * config.dp_for_red;
  let suspension = player.suspension;
  const oldThreshold = Math.floor(player.dp / config.suspension_margin);
  const newThreshold = Math.floor(dp / config.suspension_margin);
  if (newThreshold > oldThreshold && suspension === 0) {
    suspension = newThreshold;
  }

  const fitness = Math.max(0, Math.round((1 - (stat.fatigue || 0)) * 100));

  await env.DB.prepare(
    'UPDATE players SET games = ?, saves = ?, tackles = ?, keypasses = ?, shots = ?, goals = ?, assists = ?, dp = ?, injury = ?, suspension = ?, st_ab = ?, tk_ab = ?, ps_ab = ?, sh_ab = ?, st = ?, tk = ?, ps = ?, sh = ?, fitness = ? WHERE id = ?'
  ).bind(
    games, player.saves + (stat.saves || 0), player.tackles + (stat.tackles || 0),
    player.keypasses + (stat.keypasses || 0), player.shots + (stat.shots || 0),
    player.goals + (stat.goals || 0), player.assists + (stat.assists || 0),
    dp, injury, suspension, st_ab, tk_ab, ps_ab, sh_ab, st, tk, ps, sh, fitness,
    player.id
  ).run();
}

function autoLineup(roster: Player[]): LineupPlayer[] {
  const available = roster.filter((p) => p.injury === 0 && p.suspension === 0);
  const lineup: LineupPlayer[] = [];
  const used = new Set<number>();

  const positions = ['GK', 'DFC', 'DFC', 'DFC', 'DFC', 'MFC', 'MFC', 'MFC', 'MFC', 'FWC', 'FWC'];

  for (const pos of positions) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < available.length; i++) {
      if (used.has(i)) continue;
      const p = available[i];
      let score = 0;
      if (pos === 'GK') score = p.st;
      else if (pos.startsWith('DF') || pos.startsWith('DM')) score = p.tk;
      else if (pos.startsWith('MF') || pos.startsWith('AM')) score = p.ps;
      else score = p.sh;
      score = (score * p.fitness) / 100;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx !== -1) {
      used.add(bestIdx);
      lineup.push({
        player_id: available[bestIdx].id,
        name: available[bestIdx].name,
        position: pos,
        is_sub: false,
        sub_order: 0,
      });
    }
  }

  const subPositions = ['GK', 'DFC', 'MFC', 'DFC', 'FWC'];
  let subOrder = 0;
  for (const pos of subPositions) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < available.length; i++) {
      if (used.has(i)) continue;
      const p = available[i];
      let score = pos === 'GK' ? p.st : pos.startsWith('DF') ? p.tk : pos.startsWith('MF') ? p.ps : p.sh;
      score = (score * p.fitness) / 100;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx !== -1) {
      used.add(bestIdx);
      lineup.push({
        player_id: available[bestIdx].id,
        name: available[bestIdx].name,
        position: pos,
        is_sub: true,
        sub_order: ++subOrder,
      });
    }
  }

  return lineup;
}
