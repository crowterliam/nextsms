import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getFixtures, getTeams, getConfig } from '@/lib/db';
import { createTeamsheet, teamsheetToLineup } from '@/lib/teamsheet-creator';
import { simulateMatch } from '@/lib/simulator';
import { configToLeagueConfig } from '@/lib/config';
import { DEFAULT_CONFIG } from '@/lib/types';
import type { Player, LeagueConfig, SimPlayer } from '@/lib/types';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();
  const { action, season } = body as { action: string; season?: number };
  const seasonNum = season || 1;

  if (action === 'advance_week') {
    return advanceWeek(env, seasonNum);
  }

  if (action === 'recover_fitness') {
    return recoverFitness(env, seasonNum);
  }

  if (action === 'decrease_injuries') {
    return decreaseInjuries(env);
  }

  if (action === 'decrease_suspensions') {
    return decreaseSuspensions(env);
  }

  return NextResponse.json({ error: 'Unknown action. Use: advance_week, recover_fitness, decrease_injuries, decrease_suspensions' }, { status: 400 });
}

async function advanceWeek(env: CloudflareEnv, season: number) {
  const config = await loadConfig(env);

  const fixtures = await getFixtures(env.DB, season);
  if (!fixtures.results || fixtures.results.length === 0) {
    return NextResponse.json({ error: 'No fixtures found. Generate fixtures first.' }, { status: 400 });
  }

  const allFixtures = fixtures.results as Array<{
    id: number;
    week: number;
    home_team_id: number;
    away_team_id: number;
    match_id: number | null;
    home_team_name: string;
    away_team_name: string;
  }>;

  const playedWeeks = new Set<number>();
  const unplayedFixtures = allFixtures.filter(f => !f.match_id);

  for (const f of allFixtures) {
    if (f.match_id) playedWeeks.add(f.week);
  }

  let nextWeek = 0;
  for (let w = 1; w <= 100; w++) {
    if (!playedWeeks.has(w)) {
      const weekFixtures = unplayedFixtures.filter(f => f.week === w);
      if (weekFixtures.length > 0) {
        nextWeek = w;
        break;
      }
    }
  }

  if (nextWeek === 0) {
    return NextResponse.json({ error: 'All fixtures have been played!' }, { status: 400 });
  }

  const weekFixtures = unplayedFixtures.filter(f => f.week === nextWeek);
  const results: Array<{ home: string; away: string; home_score: number; away_score: number }> = [];

  for (const fixture of weekFixtures) {
    const homePlayers = await env.DB.prepare('SELECT * FROM players WHERE team_id = ?').bind(fixture.home_team_id).all();
    const awayPlayers = await env.DB.prepare('SELECT * FROM players WHERE team_id = ?').bind(fixture.away_team_id).all();
    const homeRoster = homePlayers.results as unknown as Player[];
    const awayRoster = awayPlayers.results as unknown as Player[];

    if (!homeRoster.length || !awayRoster.length) continue;

    const homeSheet = createTeamsheet(homeRoster, '442N', '', 5);
    const awaySheet = createTeamsheet(awayRoster, '442N', '', 5);
    const homeLineup = teamsheetToLineup(homeSheet);
    const awayLineup = teamsheetToLineup(awaySheet);

    const matchResult = simulateMatch(
      homeRoster, awayRoster,
      homeLineup.lineup, awayLineup.lineup,
      homeSheet.tactic, awaySheet.tactic,
      fixture.home_team_name, fixture.away_team_name,
      [], [], homeLineup.penalty_taker, awayLineup.penalty_taker,
      config
    );

    const matchInsert = await env.DB.prepare(
      `INSERT INTO matches (home_team_id, away_team_id, home_tactic, away_tactic, home_lineup, away_lineup, home_conditionals, away_conditionals, status, home_score, away_score, commentary, match_events, played_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', '[]', 'played', ?, ?, ?, ?, ?)`
    ).bind(
      fixture.home_team_id, fixture.away_team_id,
      homeSheet.tactic, awaySheet.tactic,
      JSON.stringify(homeLineup.lineup), JSON.stringify(awayLineup.lineup),
      matchResult.home_score, matchResult.away_score,
      matchResult.commentary, JSON.stringify(matchResult.events),
      new Date().toISOString()
    ).run();

    const matchId = matchInsert.meta.last_row_id;
    await env.DB.prepare('UPDATE fixtures SET match_id = ? WHERE id = ?').bind(matchId, fixture.id).run();

    for (const stat of matchResult.home_stats) {
      const player = homeRoster.find(p => p.id === stat.player_id);
      if (player) await applyStats(env, player, stat, config);
    }
    for (const stat of matchResult.away_stats) {
      const player = awayRoster.find(p => p.id === stat.player_id);
      if (player) await applyStats(env, player, stat, config);
    }

    await updateLeagueForMatch(env, fixture.home_team_id, fixture.away_team_id, matchResult.home_score, matchResult.away_score);

    results.push({
      home: fixture.home_team_name,
      away: fixture.away_team_name,
      home_score: matchResult.home_score,
      away_score: matchResult.away_score,
    });
  }

  await env.DB.prepare(
    'UPDATE players SET suspension = CASE WHEN suspension > 0 THEN suspension - 1 ELSE 0 END'
  ).run();
  await env.DB.prepare(
    'UPDATE players SET injury = CASE WHEN injury > 0 THEN injury - 1 ELSE 0 END'
  ).run();
  await env.DB.prepare(
    'UPDATE players SET fitness = CASE WHEN injury > 0 THEN fitness WHEN fitness + ? > 100 THEN 100 ELSE fitness + ? END'
  ).bind(config.updtr_fitness_gain, config.updtr_fitness_gain).run();

  return NextResponse.json({
    success: true,
    week: nextWeek,
    matches_played: results.length,
    results,
  });
}

async function recoverFitness(env: CloudflareEnv, season: number) {
  const config = await loadConfig(env);
  const gain = config.updtr_fitness_gain;
  const afterInjury = config.updtr_fitness_after_injury;

  await env.DB.prepare(
    'UPDATE players SET fitness = CASE WHEN injury > 0 THEN ? WHEN fitness + ? > 100 THEN 100 ELSE fitness + ? END'
  ).bind(afterInjury, gain, gain).run();

  return NextResponse.json({ success: true, message: `Fitness recovered by ${gain}. Injured players set to ${afterInjury}.` });
}

async function decreaseInjuries(env: CloudflareEnv) {
  const result = await env.DB.prepare(
    'UPDATE players SET injury = CASE WHEN injury > 0 THEN injury - 1 ELSE 0 END'
  ).run();
  return NextResponse.json({ success: true, message: 'All injuries decreased by 1 week.' });
}

async function decreaseSuspensions(env: CloudflareEnv) {
  const result = await env.DB.prepare(
    'UPDATE players SET suspension = CASE WHEN suspension > 0 THEN suspension - 1 ELSE 0 END'
  ).run();
  return NextResponse.json({ success: true, message: 'All suspensions decreased by 1 game.' });
}

async function loadConfig(env: CloudflareEnv): Promise<LeagueConfig> {
  try {
    const configRows = await env.DB.prepare('SELECT key, value FROM league_config').all();
    if (configRows.results && configRows.results.length > 0) {
      const configMap: Record<string, string> = {};
      for (const row of configRows.results as Array<Record<string, string>>) {
        configMap[row.key] = row.value;
      }
      return configToLeagueConfig(configMap);
    }
  } catch { /* use defaults */ }
  return DEFAULT_CONFIG;
}

async function applyStats(env: CloudflareEnv, player: Player, stat: SimPlayer, config: LeagueConfig) {
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

async function updateLeagueForMatch(env: CloudflareEnv, homeId: number, awayId: number, homeGoals: number, awayGoals: number) {
  await env.DB.prepare('INSERT OR IGNORE INTO league_table (team_id, season) VALUES (?, 1)').bind(homeId).run();
  await env.DB.prepare('INSERT OR IGNORE INTO league_table (team_id, season) VALUES (?, 1)').bind(awayId).run();

  if (homeGoals > awayGoals) {
    await env.DB.prepare(
      'UPDATE league_table SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE team_id = ? AND season = 1'
    ).bind(homeGoals, awayGoals, homeGoals - awayGoals, homeId).run();
    await env.DB.prepare(
      'UPDATE league_table SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE team_id = ? AND season = 1'
    ).bind(awayGoals, homeGoals, awayGoals - homeGoals, awayId).run();
  } else if (awayGoals > homeGoals) {
    await env.DB.prepare(
      'UPDATE league_table SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE team_id = ? AND season = 1'
    ).bind(awayGoals, homeGoals, awayGoals - homeGoals, awayId).run();
    await env.DB.prepare(
      'UPDATE league_table SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE team_id = ? AND season = 1'
    ).bind(homeGoals, awayGoals, homeGoals - awayGoals, homeId).run();
  } else {
    await env.DB.prepare(
      'UPDATE league_table SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE team_id = ? AND season = 1'
    ).bind(homeGoals, awayGoals, 0, homeId).run();
    await env.DB.prepare(
      'UPDATE league_table SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE team_id = ? AND season = 1'
    ).bind(awayGoals, homeGoals, 0, awayId).run();
  }
}
