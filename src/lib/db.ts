import type { D1Database } from '@cloudflare/workers-types';

export async function getTeams(db: D1Database) {
  return db.prepare('SELECT * FROM teams ORDER BY name').all();
}

export async function getTeam(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first();
}

export async function getTeamByAbbrev(db: D1Database, abbr: string) {
  return db.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind(abbr).first();
}

export async function createTeam(db: D1Database, name: string, abbreviation: string) {
  return db.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').bind(name, abbreviation).run();
}

export async function deleteTeam(db: D1Database, id: number) {
  return db.batch([
    db.prepare('DELETE FROM players WHERE team_id = ?').bind(id),
    db.prepare('DELETE FROM teams WHERE id = ?').bind(id),
  ]);
}

export async function getPlayers(db: D1Database, teamId: number) {
  return db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY id').bind(teamId).all();
}

export async function getPlayer(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
}

export async function createPlayer(db: D1Database, player: {
  team_id: number;
  name: string;
  age: number;
  nationality: string;
  pref_side: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  sm: number;
  ag: number;
}) {
  return db.prepare(
    `INSERT INTO players (team_id, name, age, nationality, pref_side, st, tk, ps, sh, sm, ag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(player.team_id, player.name, player.age, player.nationality, player.pref_side, player.st, player.tk, player.ps, player.sh, player.sm, player.ag).run();
}

export async function createPlayersBatch(db: D1Database, players: Array<{
  team_id: number;
  name: string;
  age: number;
  nationality: string;
  pref_side: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  sm: number;
  ag: number;
}>) {
  const stmt = db.prepare(
    `INSERT INTO players (team_id, name, age, nationality, pref_side, st, tk, ps, sh, sm, ag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const batch = players.map((p) => stmt.bind(p.team_id, p.name, p.age, p.nationality, p.pref_side, p.st, p.tk, p.ps, p.sh, p.sm, p.ag));
  return db.batch(batch);
}

const PLAYER_COLUMNS = new Set(['name', 'age', 'nationality', 'pref_side', 'st', 'tk', 'ps', 'sh', 'sm', 'ag', 'st_ab', 'tk_ab', 'ps_ab', 'sh_ab', 'games', 'saves', 'tackles', 'keypasses', 'shots', 'goals', 'assists', 'dp', 'injury', 'suspension', 'fitness']);

function filterUpdates(updates: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (allowed.has(key)) filtered[key] = updates[key];
  }
  return filtered;
}

export async function updatePlayer(db: D1Database, id: number, updates: Record<string, number | string>) {
  const safe = filterUpdates(updates, PLAYER_COLUMNS) as Record<string, number | string>;
  if (Object.keys(safe).length === 0) return;
  const sets = Object.keys(safe).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(safe), id];
  return db.prepare(`UPDATE players SET ${sets} WHERE id = ?`).bind(...values).run();
}

export async function getMatch(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM matches WHERE id = ?').bind(id).first();
}

export async function getMatches(db: D1Database, limit: number = 50) {
  return db.prepare('SELECT * FROM matches ORDER BY created_at DESC LIMIT ?').bind(limit).all();
}

export async function createMatch(db: D1Database, match: {
  home_team_id: number;
  away_team_id: number;
  home_tactic: string;
  away_tactic: string;
  home_lineup: string;
  away_lineup: string;
  home_conditionals: string;
  away_conditionals: string;
}) {
  return db.prepare(
    `INSERT INTO matches (home_team_id, away_team_id, home_tactic, away_tactic, home_lineup, away_lineup, home_conditionals, away_conditionals, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).bind(match.home_team_id, match.away_team_id, match.home_tactic, match.away_tactic, match.home_lineup, match.away_lineup, match.home_conditionals, match.away_conditionals).run();
}

export async function updateMatchResult(db: D1Database, id: number, result: {
  home_score: number;
  away_score: number;
  status: string;
  commentary: string;
  match_events: string;
  played_at: string;
}) {
  return db.prepare(
    `UPDATE matches SET home_score = ?, away_score = ?, status = ?, commentary = ?, match_events = ?, played_at = ? WHERE id = ?`
  ).bind(result.home_score, result.away_score, result.status, result.commentary, result.match_events, result.played_at, id).run();
}

export async function getFixtures(db: D1Database, season: number = 1) {
  return db.prepare(
    `SELECT f.*, ht.name as home_team_name, at.name as away_team_name
     FROM fixtures f
     JOIN teams ht ON f.home_team_id = ht.id
     JOIN teams at ON f.away_team_id = at.id
     WHERE f.season = ?
     ORDER BY f.week, f.id`
  ).bind(season).all();
}

export async function createFixtures(db: D1Database, season: number, rounds: Array<{ week: number; matches: Array<{ home: number; away: number }> }>) {
  const stmt = db.prepare(
    'INSERT INTO fixtures (season, week, home_team_id, away_team_id) VALUES (?, ?, ?, ?)'
  );
  const batch = rounds.flatMap((r) =>
    r.matches.map((m) => stmt.bind(season, r.week, m.home, m.away))
  );
  return db.batch(batch);
}

export async function deleteFixtures(db: D1Database, season: number) {
  return db.prepare('DELETE FROM fixtures WHERE season = ?').bind(season).run();
}

export async function getLeagueTable(db: D1Database, season: number = 1) {
  return db.prepare(
    `SELECT lt.*, t.name as team_name, t.abbreviation
     FROM league_table lt
     JOIN teams t ON lt.team_id = t.id
     WHERE lt.season = ?
     ORDER BY lt.points DESC, lt.goal_difference DESC, lt.goals_for DESC`
  ).bind(season).all();
}

export async function initLeagueTable(db: D1Database, season: number) {
  const teams = await db.prepare('SELECT id FROM teams').all();
  if (!teams.results || teams.results.length === 0) return;
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO league_table (team_id, season) VALUES (?, ?)'
  );
  const batch = teams.results.map((t: { id: number }) => stmt.bind(t.id, season));
  return db.batch(batch);
}

const LEAGUE_TABLE_COLUMNS = new Set(['played', 'won', 'drawn', 'lost', 'goals_for', 'goals_against', 'goal_difference', 'points']);

export async function updateLeagueEntry(db: D1Database, teamId: number, season: number, updates: {
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goals_for?: number;
  goals_against?: number;
  goal_difference?: number;
  points?: number;
}) {
  const safe = filterUpdates(updates, LEAGUE_TABLE_COLUMNS);
  if (Object.keys(safe).length === 0) return;
  const sets = Object.keys(safe).map((k) => `${k} = ${k} + ?`).join(', ');
  const values = [...Object.values(safe), teamId, season];
  return db.prepare(
    `UPDATE league_table SET ${sets} WHERE team_id = ? AND season = ?`
  ).bind(...values).run();
}

export async function getConfig(db: D1Database): Promise<Record<string, string>> {
  const result = await db.prepare('SELECT key, value FROM league_config').all();
  const config: Record<string, string> = {};
  if (result.results) {
    for (const row of result.results as Array<{ key: string; value: string }>) {
      config[row.key] = row.value;
    }
  }
  return config;
}

export async function setConfig(db: D1Database, key: string, value: string) {
  return db.prepare('INSERT OR REPLACE INTO league_config (key, value) VALUES (?, ?)').bind(key, value).run();
}

export async function setConfigBatch(db: D1Database, entries: Array<[string, string]>) {
  const stmt = db.prepare('INSERT OR REPLACE INTO league_config (key, value) VALUES (?, ?)');
  const batch = entries.map(([k, v]) => stmt.bind(k, v));
  return db.batch(batch);
}

export async function getTeamTactics(db: D1Database, teamId: number) {
  return db.prepare('SELECT * FROM team_tactics WHERE team_id = ? ORDER BY is_default DESC, tactic_code').bind(teamId).all();
}

export async function upsertTeamTactic(db: D1Database, teamId: number, tacticCode: string, formation: string, aggression: number, isDefault: boolean) {
  return db.prepare(
    'INSERT INTO team_tactics (team_id, tactic_code, formation, aggression, is_default) VALUES (?, ?, ?, ?, ?) ON CONFLICT(team_id, tactic_code) DO UPDATE SET formation = ?, aggression = ?, is_default = ?, updated_at = datetime(\'now\')'
  ).bind(teamId, tacticCode, formation, aggression, isDefault ? 1 : 0, formation, aggression, isDefault ? 1 : 0).run();
}

export async function deleteTeamTactic(db: D1Database, id: number, teamId: number) {
  return db.prepare('DELETE FROM team_tactics WHERE id = ? AND team_id = ?').bind(id, teamId).run();
}

export async function getSavedLineups(db: D1Database, teamId: number) {
  return db.prepare('SELECT * FROM team_saved_lineups WHERE team_id = ? ORDER BY is_active DESC, name').bind(teamId).all();
}

export async function getActiveLineup(db: D1Database, teamId: number) {
  return db.prepare('SELECT * FROM team_saved_lineups WHERE team_id = ? AND is_active = 1').bind(teamId).first();
}

export async function saveLineup(db: D1Database, data: {
  team_id: number;
  name: string;
  formation: string;
  tactic_code: string;
  lineup: string;
  conditionals: string;
  penalty_taker_id: number | null;
  is_active: number;
}) {
  return db.prepare(
    'INSERT INTO team_saved_lineups (team_id, name, formation, tactic_code, lineup, conditionals, penalty_taker_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(data.team_id, data.name, data.formation, data.tactic_code, data.lineup, data.conditionals, data.penalty_taker_id, data.is_active).run();
}

const LINEUP_COLUMNS = new Set(['name', 'formation', 'tactic_code', 'lineup', 'conditionals', 'penalty_taker_id', 'is_active']);

export async function updateSavedLineup(db: D1Database, id: number, teamId: number, updates: Record<string, unknown>) {
  const safe = filterUpdates(updates, LINEUP_COLUMNS);
  if (Object.keys(safe).length === 0) return;
  const sets = Object.keys(safe).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(safe), id, teamId];
  return db.prepare(`UPDATE team_saved_lineups SET ${sets}, updated_at = datetime('now') WHERE id = ? AND team_id = ?`).bind(...values).run();
}

export async function activateLineup(db: D1Database, id: number, teamId: number) {
  await db.prepare('UPDATE team_saved_lineups SET is_active = 0 WHERE team_id = ?').bind(teamId).run();
  return db.prepare('UPDATE team_saved_lineups SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ? AND team_id = ?').bind(id, teamId).run();
}

export async function deleteSavedLineup(db: D1Database, id: number, teamId: number) {
  return db.prepare('DELETE FROM team_saved_lineups WHERE id = ? AND team_id = ?').bind(id, teamId).run();
}

const TEAM_SETTINGS_COLUMNS = new Set(['name', 'abbreviation', 'default_formation', 'default_tactic', 'default_aggression', 'league_id']);

export async function updateTeamSettings(db: D1Database, teamId: number, updates: Record<string, unknown>) {
  const safe = filterUpdates(updates, TEAM_SETTINGS_COLUMNS);
  if (Object.keys(safe).length === 0) return;
  const sets = Object.keys(safe).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(safe), teamId];
  return db.prepare(`UPDATE teams SET ${sets} WHERE id = ?`).bind(...values).run();
}

export async function getActiveTransferListings(db: D1Database, leagueId?: string) {
  if (leagueId) {
    return db.prepare(
      `SELECT tl.*, p.name as player_name, p.age, p.nationality, p.pref_side, p.st, p.tk, p.ps, p.sh, p.sm, p.ag, p.fitness, p.injury, p.suspension,
       t.name as team_name, t.abbreviation as team_abbr
       FROM transfer_listings tl
       JOIN players p ON tl.player_id = p.id
       JOIN teams t ON tl.from_team_id = t.id
       WHERE tl.status = 'active' AND tl.league_id = ?
       ORDER BY tl.created_at DESC`
    ).bind(leagueId).all();
  }
  return db.prepare(
    `SELECT tl.*, p.name as player_name, p.age, p.nationality, p.pref_side, p.st, p.tk, p.ps, p.sh, p.sm, p.ag, p.fitness, p.injury, p.suspension,
     t.name as team_name, t.abbreviation as team_abbr
     FROM transfer_listings tl
     JOIN players p ON tl.player_id = p.id
     JOIN teams t ON tl.from_team_id = t.id
     WHERE tl.status = 'active'
     ORDER BY tl.created_at DESC`
  ).all();
}

export async function createTransferListing(db: D1Database, playerId: number, fromTeamId: number, askingPrice: number, leagueId?: string) {
  return db.prepare(
    'INSERT INTO transfer_listings (player_id, from_team_id, league_id, asking_price) VALUES (?, ?, ?, ?)'
  ).bind(playerId, fromTeamId, leagueId ?? null, askingPrice).run();
}

export async function withdrawTransferListing(db: D1Database, listingId: number) {
  return db.prepare("UPDATE transfer_listings SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?").bind(listingId).run();
}

export async function getTransferListing(db: D1Database, listingId: number) {
  return db.prepare('SELECT * FROM transfer_listings WHERE id = ?').bind(listingId).first();
}

export async function createTransferOffer(db: D1Database, data: {
  listing_id: number;
  from_team_id: number;
  to_team_id: number;
  player_id: number;
  amount: number;
}) {
  return db.prepare(
    'INSERT INTO transfer_offers (listing_id, from_team_id, to_team_id, player_id, amount) VALUES (?, ?, ?, ?, ?)'
  ).bind(data.listing_id, data.from_team_id, data.to_team_id, data.player_id, data.amount).run();
}

export async function getTransferOffers(db: D1Database, teamId: number) {
  return db.prepare(
    `SELECT o.*, p.name as player_name, p.st, p.tk, p.ps, p.sh,
     t.name as from_team_name
     FROM transfer_offers o
     JOIN players p ON o.player_id = p.id
     JOIN teams t ON o.from_team_id = t.id
     WHERE o.to_team_id = ? AND o.status = 'pending'
     ORDER BY o.created_at DESC`
  ).bind(teamId).all();
}

export async function getIncomingTransferOffers(db: D1Database, teamId: number) {
  return db.prepare(
    `SELECT o.*, p.name as player_name, p.st, p.tk, p.ps, p.sh,
     t.name as offering_team_name
     FROM transfer_offers o
     JOIN players p ON o.player_id = p.id
     JOIN teams t ON o.from_team_id = t.id
     JOIN transfer_listings tl ON o.listing_id = tl.id
     WHERE tl.from_team_id = ? AND o.status = 'pending'
     ORDER BY o.created_at DESC`
  ).bind(teamId).all();
}

export async function updateTransferOfferStatus(db: D1Database, offerId: number, status: string) {
  return db.prepare("UPDATE transfer_offers SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, offerId).run();
}

export async function completeTransfer(db: D1Database, listingId: number, playerId: number, toTeamId: number, amount: number, leagueId?: string) {
  const player = await db.prepare('SELECT name FROM players WHERE id = ?').bind(playerId).first<{ name: string }>();
  const fromTeam = await db.prepare('SELECT id, name FROM teams WHERE id = (SELECT from_team_id FROM transfer_listings WHERE id = ?)').bind(listingId).first<{ id: number; name: string }>();
  const toTeam = await db.prepare('SELECT id, name FROM teams WHERE id = ?').bind(toTeamId).first<{ id: number; name: string }>();

  if (!player || !fromTeam || !toTeam) throw new Error('Invalid transfer data');

  await db.batch([
    db.prepare('UPDATE players SET team_id = ? WHERE id = ?').bind(toTeamId, playerId),
    db.prepare("UPDATE transfer_listings SET status = 'sold', updated_at = datetime('now') WHERE id = ?").bind(listingId),
    db.prepare('UPDATE teams SET budget = budget + ? WHERE id = ?').bind(amount, fromTeam.id),
    db.prepare('UPDATE teams SET budget = budget - ? WHERE id = ?').bind(amount, toTeamId),
    db.prepare(
      'INSERT INTO transfer_log (player_id, player_name, from_team_id, from_team_name, to_team_id, to_team_name, league_id, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(playerId, player.name, fromTeam.id, fromTeam.name, toTeam.id, toTeam.name, leagueId ?? null, amount),
  ]);
}

export async function getTransferLog(db: D1Database, leagueId?: string) {
  if (leagueId) {
    return db.prepare('SELECT * FROM transfer_log WHERE league_id = ? ORDER BY created_at DESC LIMIT 50').bind(leagueId).all();
  }
  return db.prepare('SELECT * FROM transfer_log ORDER BY created_at DESC LIMIT 50').all();
}
