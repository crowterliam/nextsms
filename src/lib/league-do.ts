import { DurableObject } from "cloudflare:workers";
import { generateFixtures } from "./fixtures";
import { generateRoster } from "./roster-creator";
import {
  createTeamsheet,
  teamsheetToLineup,
} from "./teamsheet-creator";
import { simulateMatch } from "./simulator";
import { configToLeagueConfig } from "./config";
import { DEFAULT_CONFIG } from "./types";
import type { Player, LeagueConfig, SimPlayer } from "./types";
import { parseConditionals } from "./conditionals";
import type { ConditionalInstruction } from "./types";

function formatPlayerStats(p: SimPlayer) {
  // Rating scale: 1-10, base 4. Bonuses: goals(3), assists(2), saves(1), tackles(1),
  // keypasses(1), shot accuracy(0-2). Penalties: yellow(-1), red(-3).
  const rating = p.goals * 3 + p.assists * 2 + p.saves + p.tackles + p.keypasses
    - p.yellowcards - p.redcards * 3
    + (p.shots_on + p.shots_off > 0 ? Math.round((p.shots_on / (p.shots_on + p.shots_off)) * 2) : 0);
  return {
    name: p.name,
    pos: p.pos,
    goals: p.goals,
    assists: p.assists,
    shots: p.shots_on + p.shots_off,
    shots_on: p.shots_on,
    tackles: p.tackles,
    saves: p.saves,
    keypasses: p.keypasses,
    fouls: p.fouls,
    yellowcards: p.yellowcards,
    redcards: p.redcards,
    minutes: p.minutes,
    rating: Math.max(1, 4 + rating),
  };
}

interface LeagueState {
  season: number;
  seasonId: number | null;
  currentWeek: number;
  status: "setup" | "active" | "completed";
  name: string;
  slug: string;
}

export class LeagueDO extends DurableObject<CloudflareEnv> {
  private state: LeagueState | null = null;

  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS league_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      const rows = this.ctx.storage.sql
        .exec<{ value: string }>(
          "SELECT value FROM league_meta WHERE key = 'state'"
        )
        .toArray();
      if (rows.length > 0) {
        this.state = JSON.parse(rows[0].value);
      }
    });
  }

  private saveState() {
    if (this.state) {
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO league_meta (key, value) VALUES ('state', ?)",
        JSON.stringify(this.state)
      );
    }
  }

  async init(name: string, slug: string): Promise<{ success: boolean }> {
    if (this.state) return { success: false };
    this.state = {
      season: 1,
      seasonId: null,
      currentWeek: 0,
      status: "setup",
      name,
      slug,
    };
    this.saveState();
    return { success: true };
  }

  async getState(): Promise<LeagueState | null> {
    return this.state;
  }

  async addTeam(
    name: string,
    abbreviation: string,
    leagueId: string,
    managerUserId?: string,
    skipRoster: boolean = false
  ): Promise<{
    success: boolean;
    team?: { id: number; name: string; abbreviation: string };
  }> {
    if (!this.state) throw new Error("League not initialized");

    const existing = await this.env.DB.prepare(
      "SELECT id FROM teams WHERE abbreviation = ? AND league_id = ?"
    )
      .bind(abbreviation, leagueId)
      .first();
    if (existing) return { success: false };

    await this.env.DB.prepare(
      "INSERT INTO teams (name, abbreviation, league_id, manager_user_id) VALUES (?, ?, ?, ?)"
    )
      .bind(name, abbreviation, leagueId, managerUserId ?? null)
      .run();

    const team = (await this.env.DB.prepare(
      "SELECT id, name, abbreviation FROM teams WHERE abbreviation = ? AND league_id = ?"
    )
      .bind(abbreviation, leagueId)
      .first()) as {
      id: number;
      name: string;
      abbreviation: string;
    } | null;

    if (team && !skipRoster) {
      const roster = generateRoster();
      const stmt = this.env.DB.prepare(
        "INSERT INTO players (team_id, name, age, nationality, pref_side, st, tk, ps, sh, sm, ag, league_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      const batch = roster.players.map((p) =>
        stmt.bind(
          team.id,
          p.name,
          p.age,
          p.nationality,
          p.pref_side,
          p.st,
          p.tk,
          p.ps,
          p.sh,
          p.sm,
          p.ag,
          leagueId
        )
      );
      await this.env.DB.batch(batch);
    }

    return { success: true, team: team || undefined };
  }

  async removeTeam(teamId: number): Promise<{ success: boolean }> {
    await this.env.DB.prepare("DELETE FROM players WHERE team_id = ?")
      .bind(teamId)
      .run();
    await this.env.DB.prepare("DELETE FROM teams WHERE id = ?")
      .bind(teamId)
      .run();
    return { success: true };
  }

  async getTeams(
    leagueId: string
  ): Promise<Array<{ id: number; name: string; abbreviation: string }>> {
    const result = await this.env.DB.prepare(
      "SELECT id, name, abbreviation FROM teams WHERE league_id = ? ORDER BY name"
    )
      .bind(leagueId)
      .all();
    return result.results as Array<{
      id: number;
      name: string;
      abbreviation: string;
    }>;
  }

  async getTeamWithPlayers(teamId: number): Promise<{
    team: Record<string, unknown> | null;
    players: Player[];
  }> {
    const team = await this.env.DB.prepare(
      "SELECT * FROM teams WHERE id = ?"
    )
      .bind(teamId)
      .first();
    const players = await this.env.DB.prepare(
      "SELECT * FROM players WHERE team_id = ? ORDER BY id"
    )
      .bind(teamId)
      .all();
    return {
      team: team as Record<string, unknown> | null,
      players: (players.results as Player[]) || [],
    };
  }

  async generateLeagueFixtures(leagueId: string): Promise<{
    success: boolean;
    rounds?: number;
    matches?: number;
    error?: string;
  }> {
    if (!this.state) throw new Error("League not initialized");

    await this.env.DB.prepare(
      "DELETE FROM fixtures WHERE league_id = ?"
    )
      .bind(leagueId)
      .run();

    const teams = await this.env.DB.prepare(
      "SELECT id FROM teams WHERE league_id = ?"
    )
      .bind(leagueId)
      .all();

    if (!teams.results || teams.results.length < 2) {
      return { success: false, error: "Need at least 2 teams" };
    }

    const teamIds = (teams.results as Array<{ id: number }>).map((t) => t.id);
    const rounds = generateFixtures(teamIds);
    const season = this.state.season;

    const stmt = this.env.DB.prepare(
      "INSERT INTO fixtures (season, week, home_team_id, away_team_id, league_id) VALUES (?, ?, ?, ?, ?)"
    );
    const batch = rounds.flatMap((r) =>
      r.matches.map((m) =>
        stmt.bind(season, r.week, m.home, m.away, leagueId)
      )
    );
    await this.env.DB.batch(batch);

    this.state.status = "active";
    this.state.currentWeek = 0;
    this.saveState();

    await this.env.DB.prepare(
      "UPDATE leagues SET status = 'active' WHERE id = ?"
    )
      .bind(leagueId)
      .run();

    return {
      success: true,
      rounds: rounds.length,
      matches: rounds.reduce((acc, r) => acc + r.matches.length, 0),
    };
  }

  async getFixtures(
    leagueId: string
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.state) throw new Error("League not initialized");

    const result = await this.env.DB.prepare(
      `SELECT f.*, ht.name as home_team_name, at.name as away_team_name
       FROM fixtures f
       JOIN teams ht ON f.home_team_id = ht.id
       JOIN teams at ON f.away_team_id = at.id
       WHERE f.season = ? AND f.league_id = ?
       ORDER BY f.week, f.id`
    )
      .bind(this.state.season, leagueId)
      .all();

    return result.results as Array<Record<string, unknown>>;
  }

  async advanceWeek(leagueId: string): Promise<{
    success: boolean;
    week?: number;
    results?: Array<Record<string, unknown>>;
    error?: string;
  }> {
    if (!this.state) throw new Error("League not initialized");
    if (this.state.status !== "active") {
      return { success: false, error: "League is not active" };
    }

    const config = await this.loadConfig(leagueId);
    const fixtures = await this.env.DB.prepare(
      `SELECT f.id, f.week, f.home_team_id, f.away_team_id, f.match_id,
              ht.name as home_team_name, at.name as away_team_name
       FROM fixtures f
       JOIN teams ht ON f.home_team_id = ht.id
       JOIN teams at ON f.away_team_id = at.id
       WHERE f.season = ? AND f.league_id = ? AND f.match_id IS NULL
       ORDER BY f.week, f.id`
    )
      .bind(this.state.season, leagueId)
      .all();

    if (!fixtures.results || fixtures.results.length === 0) {
      return { success: false, error: "All fixtures have been played!" };
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

    const nextWeek = allFixtures[0].week;
    const weekFixtures = allFixtures.filter((f) => f.week === nextWeek);
    const matchResults: Array<Record<string, unknown>> = [];

    for (const fixture of weekFixtures) {
      const homePlayers = await this.env.DB.prepare(
        "SELECT * FROM players WHERE team_id = ?"
      )
        .bind(fixture.home_team_id)
        .all();
      const awayPlayers = await this.env.DB.prepare(
        "SELECT * FROM players WHERE team_id = ?"
      )
        .bind(fixture.away_team_id)
        .all();
      const homeRoster = homePlayers.results as Player[];
      const awayRoster = awayPlayers.results as Player[];
      if (!homeRoster.length || !awayRoster.length) continue;

      const homeResolved = await this.resolveTeamLineup(fixture.home_team_id, homeRoster);
      const awayResolved = await this.resolveTeamLineup(fixture.away_team_id, awayRoster);

      const matchResult = simulateMatch(
        homeRoster,
        awayRoster,
        homeResolved.lineup,
        awayResolved.lineup,
        homeResolved.tactic,
        awayResolved.tactic,
        fixture.home_team_name,
        fixture.away_team_name,
        homeResolved.conditionals,
        awayResolved.conditionals,
        homeResolved.penaltyTaker,
        awayResolved.penaltyTaker,
        config
      );

      const matchInsert = await this.env.DB.prepare(
        `INSERT INTO matches (home_team_id, away_team_id, home_tactic, away_tactic,
          home_lineup, away_lineup, home_conditionals, away_conditionals,
          status, home_score, away_score, commentary, match_events, played_at, league_id,
          home_stats, away_stats, home_possession, away_possession)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'played', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          fixture.home_team_id,
          fixture.away_team_id,
          homeResolved.tactic,
          awayResolved.tactic,
          JSON.stringify(homeResolved.lineup),
          JSON.stringify(awayResolved.lineup),
          JSON.stringify(homeResolved.conditionals),
          JSON.stringify(awayResolved.conditionals),
          matchResult.home_score,
          matchResult.away_score,
          matchResult.commentary,
          JSON.stringify(matchResult.events),
          new Date().toISOString(),
          leagueId,
          JSON.stringify(matchResult.home_stats.map(formatPlayerStats)),
          JSON.stringify(matchResult.away_stats.map(formatPlayerStats)),
          matchResult.home_possession,
          matchResult.away_possession
        )
        .run();

      const matchId = matchInsert.meta.last_row_id;
      await this.env.DB.prepare(
        "UPDATE fixtures SET match_id = ? WHERE id = ?"
      )
        .bind(matchId, fixture.id)
        .run();

      for (const stat of matchResult.home_stats) {
        const player = homeRoster.find((p) => p.id === stat.player_id);
        if (player) await this.applyStats(player, stat, config);
      }
      for (const stat of matchResult.away_stats) {
        const player = awayRoster.find((p) => p.id === stat.player_id);
        if (player) await this.applyStats(player, stat, config);
      }

      await this.updateLeagueForMatch(
        fixture.home_team_id,
        fixture.away_team_id,
        matchResult.home_score,
        matchResult.away_score,
        leagueId
      );

      matchResults.push({
        home: fixture.home_team_name,
        away: fixture.away_team_name,
        home_score: matchResult.home_score,
        away_score: matchResult.away_score,
      });
    }

    await this.env.DB.prepare(
      "UPDATE players SET suspension = CASE WHEN suspension > 0 THEN suspension - 1 ELSE 0 END WHERE team_id IN (SELECT id FROM teams WHERE league_id = ?)"
    )
      .bind(leagueId)
      .run();
    await this.env.DB.prepare(
      "UPDATE players SET injury = CASE WHEN injury > 0 THEN injury - 1 ELSE 0 END WHERE team_id IN (SELECT id FROM teams WHERE league_id = ?)"
    )
      .bind(leagueId)
      .run();
    await this.env.DB.prepare(
      "UPDATE players SET fitness = CASE WHEN injury > 0 THEN fitness WHEN fitness + ? > 100 THEN 100 ELSE fitness + ? END WHERE team_id IN (SELECT id FROM teams WHERE league_id = ?)"
    )
      .bind(
        config.updtr_fitness_gain,
        config.updtr_fitness_gain,
        leagueId
      )
      .run();

    this.state.currentWeek = nextWeek;
    this.saveState();

    return { success: true, week: nextWeek, results: matchResults };
  }

  async getLeagueTable(
    leagueId: string
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.state) throw new Error("League not initialized");

    await this.env.DB.prepare(
      "INSERT OR IGNORE INTO league_table (team_id, season, league_id) SELECT id, ?, ? FROM teams WHERE league_id = ?"
    )
      .bind(this.state.season, leagueId, leagueId)
      .run();

    const result = await this.env.DB.prepare(
      `SELECT lt.*, t.name as team_name, t.abbreviation
       FROM league_table lt
       JOIN teams t ON lt.team_id = t.id
       WHERE lt.season = ? AND lt.league_id = ?
       ORDER BY lt.points DESC, lt.goal_difference DESC, lt.goals_for DESC`
    )
      .bind(this.state.season, leagueId)
      .all();

    return result.results as Array<Record<string, unknown>>;
  }

  async getMatches(
    leagueId: string,
    limit: number = 50
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.env.DB.prepare(
      `SELECT m.*, ht.name as home_team_name, at.name as away_team_name
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       WHERE m.league_id = ?
       ORDER BY m.created_at DESC LIMIT ?`
    )
      .bind(leagueId, limit)
      .all();
    return result.results as Array<Record<string, unknown>>;
  }

  async getMatch(
    matchId: number
  ): Promise<Record<string, unknown> | null> {
    const result = await this.env.DB.prepare(
      `SELECT m.*, ht.name as home_team_name, at.name as away_team_name
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       WHERE m.id = ?`
    )
      .bind(matchId)
      .first();
    return result as Promise<Record<string, unknown> | null>;
  }

  async simulateQuickMatch(
    homeTeamId: number,
    awayTeamId: number,
    leagueId: string,
    seed?: number
  ): Promise<Record<string, unknown>> {
    const config = await this.loadConfig(leagueId);

    const homePlayers = await this.env.DB.prepare(
      "SELECT * FROM players WHERE team_id = ?"
    )
      .bind(homeTeamId)
      .all();
    const awayPlayers = await this.env.DB.prepare(
      "SELECT * FROM players WHERE team_id = ?"
    )
      .bind(awayTeamId)
      .all();
    const homeRoster = (homePlayers.results as Player[]) || [];
    const awayRoster = (awayPlayers.results as Player[]) || [];

    if (!homeRoster.length || !awayRoster.length) {
      return { error: "Both teams need players" };
    }

    const homeResolved = await this.resolveTeamLineup(homeTeamId, homeRoster);
    const awayResolved = await this.resolveTeamLineup(awayTeamId, awayRoster);

    const homeTeam = (await this.env.DB.prepare(
      "SELECT name FROM teams WHERE id = ?"
    )
      .bind(homeTeamId)
      .first()) as { name: string } | null;
    const awayTeam = (await this.env.DB.prepare(
      "SELECT name FROM teams WHERE id = ?"
    )
      .bind(awayTeamId)
      .first()) as { name: string } | null;

    const matchResult = simulateMatch(
      homeRoster,
      awayRoster,
      homeResolved.lineup,
      awayResolved.lineup,
      homeResolved.tactic,
      awayResolved.tactic,
      homeTeam?.name || "Home",
      awayTeam?.name || "Away",
      homeResolved.conditionals,
      awayResolved.conditionals,
      homeResolved.penaltyTaker,
      awayResolved.penaltyTaker,
      config,
      seed
    );

    return {
      home_score: matchResult.home_score,
      away_score: matchResult.away_score,
      events: matchResult.events,
      commentary: matchResult.commentary,
      home_tactic: homeResolved.tactic,
      away_tactic: awayResolved.tactic,
      home_starting: homeResolved.lineup.filter(p => !p.is_sub).map((s) => ({
        position: s.position,
        name: s.name,
      })),
      away_starting: awayResolved.lineup.filter(p => !p.is_sub).map((s) => ({
        position: s.position,
        name: s.name,
      })),
    };
  }

  async updateLeagueConfig(
    leagueId: string,
    settings: Record<string, string>
  ): Promise<{ success: boolean }> {
    const entries = Object.entries(settings);
    if (entries.length === 0) return { success: true };
    const stmt = this.env.DB.prepare(
      "INSERT OR REPLACE INTO league_config (key, value, league_id) VALUES (?, ?, ?)"
    );
    const batch = entries.map(([k, v]) =>
      stmt.bind(k, v, leagueId)
    );
    await this.env.DB.batch(batch);
    return { success: true };
  }

  async getLeagueConfig(
    leagueId: string
  ): Promise<Record<string, string>> {
    const result = await this.env.DB.prepare(
      "SELECT key, value FROM league_config WHERE league_id = ?"
    )
      .bind(leagueId)
      .all();
    const config: Record<string, string> = {};
    if (result.results) {
      for (const row of result.results as Array<{
        key: string;
        value: string;
      }>) {
        config[row.key] = row.value;
      }
    }
    return config;
  }

  async deleteMatch(leagueId: string, matchId: number): Promise<{ success: boolean; error?: string }> {
    const match = await this.env.DB.prepare(
      "SELECT id, home_team_id, away_team_id, home_score, away_score, status FROM matches WHERE id = ? AND league_id = ?"
    )
      .bind(matchId, leagueId)
      .first<{ id: number; home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string }>();

    if (!match) return { success: false, error: "Match not found" };

    await this.env.DB.prepare(
      "UPDATE fixtures SET match_id = NULL WHERE match_id = ? AND league_id = ?"
    )
      .bind(matchId, leagueId)
      .run();

    if (match.status === "played" && this.state) {
      const season = this.state.season;
      await this.reverseLeagueTable(match.home_team_id, match.away_team_id, match.home_score, match.away_score, leagueId, season);
    }

    await this.env.DB.prepare("DELETE FROM matches WHERE id = ?")
      .bind(matchId)
      .run();

    return { success: true };
  }

  async resetFixture(leagueId: string, fixtureId: number): Promise<{ success: boolean; error?: string }> {
    const fixture = await this.env.DB.prepare(
      "SELECT id, match_id FROM fixtures WHERE id = ? AND league_id = ?"
    )
      .bind(fixtureId, leagueId)
      .first<{ id: number; match_id: number | null }>();

    if (!fixture) return { success: false, error: "Fixture not found" };

    if (fixture.match_id) {
      const match = await this.env.DB.prepare(
        "SELECT home_team_id, away_team_id, home_score, away_score, status FROM matches WHERE id = ?"
      )
        .bind(fixture.match_id)
        .first<{ home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string }>();

      if (match?.status === "played" && this.state) {
        await this.reverseLeagueTable(match.home_team_id, match.away_team_id, match.home_score, match.away_score, leagueId, this.state.season);
      }

      await this.env.DB.prepare("DELETE FROM matches WHERE id = ?")
        .bind(fixture.match_id)
        .run();
    }

    await this.env.DB.prepare(
      "UPDATE fixtures SET match_id = NULL WHERE id = ?"
    )
      .bind(fixtureId)
      .run();

    return { success: true };
  }

  async bulkResetWeek(leagueId: string, week: number): Promise<{ success: boolean; resetCount?: number; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    const fixtures = await this.env.DB.prepare(
      "SELECT id, match_id FROM fixtures WHERE week = ? AND season = ? AND league_id = ?"
    )
      .bind(week, this.state.season, leagueId)
      .all<{ id: number; match_id: number | null }>();

    if (!fixtures.results?.length) {
      return { success: false, error: "No fixtures found for this week" };
    }

    let resetCount = 0;
    for (const fixture of fixtures.results) {
      if (fixture.match_id) {
        const match = await this.env.DB.prepare(
          "SELECT home_team_id, away_team_id, home_score, away_score, status FROM matches WHERE id = ?"
        )
          .bind(fixture.match_id)
          .first<{ home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string }>();

        if (match?.status === "played" && this.state) {
          await this.reverseLeagueTable(match.home_team_id, match.away_team_id, match.home_score, match.away_score, leagueId, this.state.season);
        }

        await this.env.DB.prepare("DELETE FROM matches WHERE id = ?")
          .bind(fixture.match_id)
          .run();
      }

      await this.env.DB.prepare(
        "UPDATE fixtures SET match_id = NULL WHERE id = ?"
      )
        .bind(fixture.id)
        .run();
      resetCount++;
    }

    return { success: true, resetCount };
  }

  async bulkDeleteMatches(leagueId: string, matchIds: number[]): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    if (!matchIds.length) return { success: false, error: "No match IDs provided" };

    let deletedCount = 0;
    for (const matchId of matchIds) {
      const result = await this.deleteMatch(leagueId, matchId);
      if (result.success) deletedCount++;
    }

    return { success: true, deletedCount };
  }

  async editMatchScore(leagueId: string, matchId: number, homeScore: number, awayScore: number): Promise<{ success: boolean; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    const match = await this.env.DB.prepare(
      "SELECT id, home_team_id, away_team_id, home_score, away_score, status, league_id FROM matches WHERE id = ?"
    )
      .bind(matchId)
      .first<{ id: number; home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string; league_id: string }>();

    if (!match) return { success: false, error: "Match not found" };
    if (match.league_id !== leagueId) return { success: false, error: "Match not in this league" };
    if (match.status !== "played") return { success: false, error: "Match has not been played yet" };

    await this.reverseLeagueTable(match.home_team_id, match.away_team_id, match.home_score, match.away_score, leagueId, this.state.season);

    await this.updateLeagueForMatch(match.home_team_id, match.away_team_id, homeScore, awayScore, leagueId);

    await this.env.DB.prepare(
      "UPDATE matches SET home_score = ?, away_score = ? WHERE id = ?"
    )
      .bind(homeScore, awayScore, matchId)
      .run();

    return { success: true };
  }

  async resetAllFixtures(leagueId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    const matches = await this.env.DB.prepare(
      "SELECT id, home_team_id, away_team_id, home_score, away_score, status FROM matches WHERE league_id = ?"
    )
      .bind(leagueId)
      .all<{ id: number; home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string }>();

    for (const match of (matches.results || [])) {
      if (match.status === "played") {
        await this.reverseLeagueTable(match.home_team_id, match.away_team_id, match.home_score, match.away_score, leagueId, this.state.season);
      }
    }

    await this.env.DB.batch([
      this.env.DB.prepare("DELETE FROM matches WHERE league_id = ?").bind(leagueId),
      this.env.DB.prepare("UPDATE fixtures SET match_id = NULL WHERE league_id = ?").bind(leagueId),
    ]);

    this.state.currentWeek = 0;
    this.saveState();

    return { success: true };
  }

  async destroy(leagueId: string): Promise<{ success: boolean }> {
    const tables = [
      "DELETE FROM league_config WHERE league_id = ?",
      "DELETE FROM league_table WHERE league_id = ?",
      "DELETE FROM fixtures WHERE league_id = ?",
      "DELETE FROM matches WHERE league_id = ?",
    ];
    for (const sql of tables) {
      await this.env.DB.prepare(sql).bind(leagueId).run();
    }

    const teams = await this.env.DB.prepare(
      "SELECT id FROM teams WHERE league_id = ?"
    )
      .bind(leagueId)
      .all();
    if (teams.results?.length) {
      const teamIds = (teams.results as Array<{ id: number }>).map(
        (t) => t.id
      );
      for (const tid of teamIds) {
        await this.env.DB.prepare("DELETE FROM players WHERE team_id = ?")
          .bind(tid)
          .run();
      }
    }
    await this.env.DB.prepare("DELETE FROM teams WHERE league_id = ?")
      .bind(leagueId)
      .run();

    this.ctx.storage.sql.exec("DELETE FROM league_meta");
    this.state = null;

    return { success: true };
  }

  async getSeasons(leagueId: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.env.DB.prepare(
      "SELECT * FROM seasons WHERE league_id = ? ORDER BY season_number DESC"
    ).bind(leagueId).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async getCurrentSeason(leagueId: string): Promise<Record<string, unknown> | null> {
    if (this.state?.seasonId) {
      const result = await this.env.DB.prepare(
        "SELECT * FROM seasons WHERE id = ?"
      ).bind(this.state.seasonId).first();
      return result as Record<string, unknown> | null;
    }
    const result = await this.env.DB.prepare(
      "SELECT * FROM seasons WHERE league_id = ? ORDER BY season_number DESC LIMIT 1"
    ).bind(leagueId).first();
    return result as Record<string, unknown> | null;
  }

  async startNewSeason(leagueId: string, name?: string): Promise<{ success: boolean; seasonId?: number; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    const currentSeason = await this.env.DB.prepare(
      "SELECT season_number FROM seasons WHERE league_id = ? ORDER BY season_number DESC LIMIT 1"
    ).bind(leagueId).first<{ season_number: number }>();

    const nextNumber = (currentSeason?.season_number ?? 0) + 1;
    const seasonName = name || `Season ${nextNumber}`;

    const insert = await this.env.DB.prepare(
      "INSERT INTO seasons (league_id, season_number, name, status) VALUES (?, ?, ?, 'active')"
    ).bind(leagueId, nextNumber, seasonName).run();

    const seasonRow = await this.env.DB.prepare(
      "SELECT id FROM seasons WHERE league_id = ? AND season_number = ?"
    ).bind(leagueId, nextNumber).first<{ id: number }>();

    if (!seasonRow) return { success: false, error: "Failed to create season" };

    this.state.season = nextNumber;
    this.state.seasonId = seasonRow.id;
    this.state.currentWeek = 0;
    this.state.status = "setup";
    this.saveState();

    await this.env.DB.prepare(
      "UPDATE leagues SET season = ?, current_week = 0, status = 'setup' WHERE id = ?"
    ).bind(nextNumber, leagueId).run();

    return { success: true, seasonId: seasonRow.id };
  }

  async completeCurrentSeason(leagueId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.state || !this.state.seasonId) return { success: false, error: "No active season" };

    const teams = await this.env.DB.prepare(
      "SELECT id FROM teams WHERE league_id = ?"
    ).bind(leagueId).all();

    const standings = await this.env.DB.prepare(
      `SELECT lt.*, t.name as team_name FROM league_table lt
       JOIN teams t ON lt.team_id = t.id
       WHERE lt.season = ? AND lt.league_id = ?
       ORDER BY lt.points DESC, lt.goal_difference DESC, lt.goals_for DESC`
    ).bind(this.state.season, leagueId).all();

    const competitions = await this.env.DB.prepare(
      "SELECT * FROM competitions WHERE season_id = ? AND league_id = ?"
    ).bind(this.state.seasonId, leagueId).all();

    await this.env.DB.prepare(
      "INSERT INTO season_history (league_id, season_id, category, data) VALUES (?, ?, 'standings', ?)"
    ).bind(leagueId, this.state.seasonId, JSON.stringify(standings.results)).run();

    if (competitions.results?.length) {
      for (const comp of competitions.results as Array<Record<string, unknown>>) {
        const compId = comp.id;
        const compFixtures = await this.env.DB.prepare(
          "SELECT * FROM competition_fixtures WHERE competition_id = ?"
        ).bind(compId).all();
        await this.env.DB.prepare(
          "INSERT INTO season_history (league_id, season_id, category, data) VALUES (?, ?, 'competition', ?)"
        ).bind(leagueId, this.state.seasonId, JSON.stringify({ competition: comp, fixtures: compFixtures.results })).run();
      }
    }

    const divisionCount = await this.env.DB.prepare(
      "SELECT COUNT(*) as count FROM divisions WHERE season_id = ?"
    ).bind(this.state.seasonId).first<{ count: number }>();

    if (divisionCount && divisionCount.count > 0) {
      const divisions = await this.env.DB.prepare(
        "SELECT * FROM divisions WHERE season_id = ?"
      ).bind(this.state.seasonId).all();
      const divisionData: Record<string, unknown> = {};
      for (const div of divisions.results as Array<Record<string, unknown>>) {
        const divStandings = await this.env.DB.prepare(
          `SELECT cs.*, t.name as team_name FROM competition_standings cs
           JOIN teams t ON cs.team_id = t.id
           JOIN competitions c ON cs.competition_id = c.id
           WHERE c.division_id = ? AND c.season_id = ?
           ORDER BY cs.points DESC, cs.goal_difference DESC`
        ).bind(div.id, this.state.seasonId).all();
        divisionData[String(div.id)] = { division: div, standings: divStandings.results };
      }
      await this.env.DB.prepare(
        "INSERT INTO season_history (league_id, season_id, category, data) VALUES (?, ?, 'divisions', ?)"
      ).bind(leagueId, this.state.seasonId, JSON.stringify(divisionData)).run();
    }

    await this.env.DB.prepare(
      "UPDATE seasons SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
    ).bind(this.state.seasonId).run();

    await this.env.DB.prepare(
      "UPDATE competitions SET status = 'completed' WHERE season_id = ?"
    ).bind(this.state.seasonId).run();

    this.state.status = "completed";
    this.saveState();

    await this.env.DB.prepare(
      "UPDATE leagues SET status = 'completed' WHERE id = ?"
    ).bind(leagueId).run();

    return { success: true };
  }

  async getSeasonHistory(leagueId: string, seasonId?: number): Promise<Array<Record<string, unknown>>> {
    if (seasonId) {
      const result = await this.env.DB.prepare(
        "SELECT * FROM season_history WHERE league_id = ? AND season_id = ? ORDER BY created_at"
      ).bind(leagueId, seasonId).all();
      return result.results as Array<Record<string, unknown>>;
    }
    const result = await this.env.DB.prepare(
      "SELECT * FROM season_history WHERE league_id = ? ORDER BY season_id DESC, created_at"
    ).bind(leagueId).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async createDivision(
    leagueId: string,
    seasonId: number,
    name: string,
    level: number,
    promotionSpots: number = 0,
    relegationSpots: number = 0,
    playoffSpots: number = 0
  ): Promise<{ success: boolean; divisionId?: number; error?: string }> {
    const existing = await this.env.DB.prepare(
      "SELECT id FROM divisions WHERE league_id = ? AND season_id = ? AND level = ?"
    ).bind(leagueId, seasonId, level).first();
    if (existing) return { success: false, error: "Division at this level already exists for this season" };

    await this.env.DB.prepare(
      "INSERT INTO divisions (league_id, season_id, name, level, promotion_spots, relegation_spots, playoff_spots) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(leagueId, seasonId, name, level, promotionSpots, relegationSpots, playoffSpots).run();

    const div = await this.env.DB.prepare(
      "SELECT id FROM divisions WHERE league_id = ? AND season_id = ? AND level = ?"
    ).bind(leagueId, seasonId, level).first<{ id: number }>();

    return { success: true, divisionId: div?.id };
  }

  async getDivisions(leagueId: string, seasonId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.env.DB.prepare(
      "SELECT * FROM divisions WHERE league_id = ? AND season_id = ? ORDER BY level"
    ).bind(leagueId, seasonId).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async getDivisionTeams(divisionId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.env.DB.prepare(
      `SELECT dt.*, t.name as team_name, t.abbreviation FROM division_teams dt
       JOIN teams t ON dt.team_id = t.id
       WHERE dt.division_id = ? ORDER BY t.name`
    ).bind(divisionId).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async assignTeamToDivision(divisionId: number, teamId: number, seasonId: number): Promise<{ success: boolean; error?: string }> {
    const existing = await this.env.DB.prepare(
      "SELECT id FROM division_teams WHERE team_id = ? AND season_id = ?"
    ).bind(teamId, seasonId).first();
    if (existing) return { success: false, error: "Team already assigned to a division this season" };

    await this.env.DB.prepare(
      "INSERT INTO division_teams (division_id, team_id, season_id) VALUES (?, ?, ?)"
    ).bind(divisionId, teamId, seasonId).run();
    return { success: true };
  }

  async removeTeamFromDivision(divisionId: number, teamId: number): Promise<{ success: boolean }> {
    await this.env.DB.prepare(
      "DELETE FROM division_teams WHERE division_id = ? AND team_id = ?"
    ).bind(divisionId, teamId).run();
    return { success: true };
  }

  async autoAssignDivisions(leagueId: string, seasonId: number): Promise<{ success: boolean; assignments?: Record<number, number[]>; error?: string }> {
    const divisions = await this.env.DB.prepare(
      "SELECT id, level FROM divisions WHERE league_id = ? AND season_id = ? ORDER BY level"
    ).bind(leagueId, seasonId).all<{ id: number; level: number }>();

    if (!divisions.results?.length) return { success: false, error: "No divisions created" };

    const teams = await this.env.DB.prepare(
      "SELECT id FROM teams WHERE league_id = ? ORDER BY name"
    ).bind(leagueId).all<{ id: number }>();

    if (!teams.results?.length) return { success: false, error: "No teams in league" };

    const standings = await this.env.DB.prepare(
      `SELECT lt.team_id, lt.points, lt.goal_difference FROM league_table lt
       WHERE lt.league_id = ? ORDER BY lt.points DESC, lt.goal_difference DESC`
    ).bind(leagueId).all<{ team_id: number; points: number; goal_difference: number }>();

    const standingMap = new Map(standings.results.map(s => [s.team_id, s]));
    const sortedTeams = [...teams.results].sort((a, b) => {
      const sa = standingMap.get(a.id);
      const sb = standingMap.get(b.id);
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sb.points - sa.points || sb.goal_difference - sa.goal_difference;
    });

    await this.env.DB.prepare(
      "DELETE FROM division_teams WHERE season_id = ?"
    ).bind(seasonId).run();

    const teamsPerDivision = Math.ceil(sortedTeams.length / divisions.results.length);
    const assignments: Record<number, number[]> = {};

    for (let i = 0; i < divisions.results.length; i++) {
      const divId = divisions.results[i].id;
      assignments[divId] = [];
      const start = i * teamsPerDivision;
      const end = Math.min(start + teamsPerDivision, sortedTeams.length);
      const batch: D1PreparedStatement[] = [];
      const stmt = this.env.DB.prepare(
        "INSERT INTO division_teams (division_id, team_id, season_id) VALUES (?, ?, ?)"
      );
      for (let j = start; j < end; j++) {
        batch.push(stmt.bind(divId, sortedTeams[j].id, seasonId));
        assignments[divId].push(sortedTeams[j].id);
      }
      if (batch.length) await this.env.DB.batch(batch);
    }

    return { success: true, assignments };
  }

  async deleteDivision(divisionId: number): Promise<{ success: boolean }> {
    await this.env.DB.prepare("DELETE FROM division_teams WHERE division_id = ?").bind(divisionId).run();
    await this.env.DB.prepare("DELETE FROM divisions WHERE id = ?").bind(divisionId).run();
    return { success: true };
  }

  async createCompetition(
    leagueId: string,
    seasonId: number,
    name: string,
    type: string,
    format: string,
    divisionId?: number | null,
    settings?: Record<string, unknown>
  ): Promise<{ success: boolean; competitionId?: number; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    await this.env.DB.prepare(
      "INSERT INTO competitions (league_id, season_id, division_id, name, type, format, status, settings) VALUES (?, ?, ?, ?, ?, ?, 'setup', ?)"
    ).bind(leagueId, seasonId, divisionId ?? null, name, type, format, JSON.stringify(settings || {})).run();

    const comp = await this.env.DB.prepare(
      "SELECT id FROM competitions WHERE league_id = ? AND season_id = ? AND name = ? ORDER BY id DESC LIMIT 1"
    ).bind(leagueId, seasonId, name).first<{ id: number }>();

    return { success: true, competitionId: comp?.id };
  }

  async getCompetitions(leagueId: string, seasonId?: number): Promise<Array<Record<string, unknown>>> {
    if (seasonId) {
      const result = await this.env.DB.prepare(
        "SELECT * FROM competitions WHERE league_id = ? AND season_id = ? ORDER BY type, name"
      ).bind(leagueId, seasonId).all();
      return result.results as Array<Record<string, unknown>>;
    }
    const result = await this.env.DB.prepare(
      "SELECT * FROM competitions WHERE league_id = ? ORDER BY season_id DESC, type, name"
    ).bind(leagueId).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async getCompetition(competitionId: number): Promise<Record<string, unknown> | null> {
    const comp = await this.env.DB.prepare(
      "SELECT * FROM competitions WHERE id = ?"
    ).bind(competitionId).first();
    return comp as Record<string, unknown> | null;
  }

  async deleteCompetition(competitionId: number, leagueId: string): Promise<{ success: boolean; error?: string }> {
    const stages = await this.env.DB.prepare(
      "SELECT id FROM competition_stages WHERE competition_id = ?"
    ).bind(competitionId).all<{ id: number }>();

    for (const stage of stages.results) {
      const groups = await this.env.DB.prepare(
        "SELECT id FROM competition_groups WHERE stage_id = ?"
      ).bind(stage.id).all<{ id: number }>();

      for (const group of groups.results) {
        await this.env.DB.prepare("DELETE FROM competition_group_teams WHERE group_id = ?").bind(group.id).run();
        await this.env.DB.prepare("DELETE FROM competition_standings WHERE group_id = ?").bind(group.id).run();
      }
      await this.env.DB.prepare("DELETE FROM competition_groups WHERE stage_id = ?").bind(stage.id).run();
      await this.env.DB.prepare("DELETE FROM competition_standings WHERE stage_id = ?").bind(stage.id).run();
    }

    const compFixtures = await this.env.DB.prepare(
      "SELECT match_id FROM competition_fixtures WHERE competition_id = ? AND match_id IS NOT NULL"
    ).bind(competitionId).all<{ match_id: number }>();

    for (const cf of compFixtures.results) {
      await this.env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(cf.match_id).run();
    }

    await this.env.DB.prepare("DELETE FROM competition_fixtures WHERE competition_id = ?").bind(competitionId).run();
    await this.env.DB.prepare("DELETE FROM competition_stages WHERE competition_id = ?").bind(competitionId).run();
    await this.env.DB.prepare("DELETE FROM competitions WHERE id = ?").bind(competitionId).run();

    return { success: true };
  }

  async addCompetitionStage(
    competitionId: number,
    name: string,
    format: string,
    stageOrder: number,
    numGroups: number = 0,
    teamsAdvancing: number = 0,
    numLegs: number = 1,
    config?: Record<string, unknown>
  ): Promise<{ success: boolean; stageId?: number; error?: string }> {
    await this.env.DB.prepare(
      "INSERT INTO competition_stages (competition_id, name, stage_order, format, num_groups, teams_advancing, num_legs, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(competitionId, name, stageOrder, format, numGroups, teamsAdvancing, numLegs, JSON.stringify(config || {})).run();

    const stage = await this.env.DB.prepare(
      "SELECT id FROM competition_stages WHERE competition_id = ? AND stage_order = ?"
    ).bind(competitionId, stageOrder).first<{ id: number }>();

    if (numGroups > 0 && stage) {
      const groupLetters = 'ABCDEFGHIJKLMNOP';
      const batch: D1PreparedStatement[] = [];
      const stmt = this.env.DB.prepare(
        "INSERT INTO competition_groups (stage_id, name) VALUES (?, ?)"
      );
      for (let g = 0; g < numGroups; g++) {
        batch.push(stmt.bind(stage.id, groupLetters[g] || `Group ${g + 1}`));
      }
      await this.env.DB.batch(batch);
    }

    return { success: true, stageId: stage?.id };
  }

  async getCompetitionStages(competitionId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.env.DB.prepare(
      "SELECT * FROM competition_stages WHERE competition_id = ? ORDER BY stage_order"
    ).bind(competitionId).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async generateCompetitionFixtures(
    competitionId: number,
    leagueId: string,
    teamIds?: number[],
    stageId?: number
  ): Promise<{ success: boolean; fixturesCount?: number; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    const comp = await this.env.DB.prepare(
      "SELECT * FROM competitions WHERE id = ?"
    ).bind(competitionId).first<{ id: number; season_id: number; type: string; format: string; division_id: number | null }>();

    if (!comp) return { success: false, error: "Competition not found" };

    const stages = await this.env.DB.prepare(
      "SELECT * FROM competition_stages WHERE competition_id = ? ORDER BY stage_order"
    ).bind(competitionId).all<{
      id: number; name: string; stage_order: number; format: string;
      num_groups: number; teams_advancing: number; num_legs: number;
    }>();

    if (!stages.results?.length) return { success: false, error: "No stages defined" };

    let currentTeamIds = teamIds;

    if (!currentTeamIds) {
      if (comp.division_id) {
        const divTeams = await this.env.DB.prepare(
          "SELECT team_id FROM division_teams WHERE division_id = ?"
        ).bind(comp.division_id).all<{ team_id: number }>();
        currentTeamIds = divTeams.results.map(t => t.team_id);
      } else {
        const allTeams = await this.env.DB.prepare(
          "SELECT id FROM teams WHERE league_id = ?"
        ).bind(leagueId).all<{ id: number }>();
        currentTeamIds = allTeams.results.map(t => t.id);
      }
    }

    if (!currentTeamIds || currentTeamIds.length < 2) {
      return { success: false, error: "Need at least 2 teams" };
    }

    let totalFixtures = 0;
    let startStageIdx = 0;

    if (stageId) {
      const idx = stages.results.findIndex(s => s.id === stageId);
      if (idx >= 0) startStageIdx = idx;
    }

    for (let si = startStageIdx; si < stages.results.length; si++) {
      const stage = stages.results[si];
      const isLastStage = si === stages.results.length - 1;

      await this.env.DB.prepare(
        "DELETE FROM competition_fixtures WHERE stage_id = ?"
      ).bind(stage.id).run();

      if (stage.format === 'round_robin') {
        const rounds = generateFixtures(currentTeamIds);
        const stmt = this.env.DB.prepare(
          "INSERT INTO competition_fixtures (competition_id, stage_id, group_id, home_team_id, away_team_id, round_name, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
        );
        const batch = rounds.flatMap(r =>
          r.matches.map(m =>
            stmt.bind(competitionId, stage.id, null, m.home, m.away, `Week ${r.week}`)
          )
        );
        if (batch.length) await this.env.DB.batch(batch);
        totalFixtures += batch.length;

        for (const tid of currentTeamIds) {
          await this.env.DB.prepare(
            "INSERT OR IGNORE INTO competition_standings (competition_id, stage_id, group_id, team_id) VALUES (?, ?, NULL, ?)"
          ).bind(competitionId, stage.id, tid).run();
        }
      } else if (stage.format === 'knockout') {
        const bracket = generateKnockoutBracket(currentTeamIds);
        const stmt = this.env.DB.prepare(
          "INSERT INTO competition_fixtures (competition_id, stage_id, group_id, home_team_id, away_team_id, round_name, bracket_position, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')"
        );
        for (const round of bracket) {
          const batch = round.matches.map(m =>
            stmt.bind(competitionId, stage.id, null, m.home_team_id, m.away_team_id, round.round_name, m.bracket_position)
          );
          if (batch.length) await this.env.DB.batch(batch);
          totalFixtures += batch.length;
        }
      } else if (stage.format === 'two_legged_knockout') {
        const bracket = generateTwoLeggedKnockoutBracket(currentTeamIds);
        const stmt = this.env.DB.prepare(
          "INSERT INTO competition_fixtures (competition_id, stage_id, group_id, home_team_id, away_team_id, round_name, leg, bracket_position, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')"
        );
        for (const round of bracket) {
          const batch = round.matches.map(m =>
            stmt.bind(competitionId, stage.id, null, m.home_team_id, m.away_team_id, round.round_name, m.leg || 1, m.bracket_position)
          );
          if (batch.length) await this.env.DB.batch(batch);
          totalFixtures += batch.length;
        }
      } else if (stage.format === 'group_knockout') {
        const numGroups = stage.num_groups || 4;
        const teamsPerGroup = Math.ceil(currentTeamIds.length / numGroups);
        const draw = generateGroupDraw(currentTeamIds, numGroups);

        const groups: Array<{ id: number; name: string; team_ids: number[] }> = [];

        const existingGroups = await this.env.DB.prepare(
          "DELETE FROM competition_groups WHERE stage_id = ?"
        ).bind(stage.id).run();

        const groupLetters = 'ABCDEFGHIJKLMNOP';
        const groupStmt = this.env.DB.prepare(
          "INSERT INTO competition_groups (stage_id, name) VALUES (?, ?)"
        );
        const groupBatch = draw.groups.map(g =>
          groupStmt.bind(stage.id, g.name)
        );
        await this.env.DB.batch(groupBatch);

        const dbGroups = await this.env.DB.prepare(
          "SELECT id, name FROM competition_groups WHERE stage_id = ? ORDER BY id"
        ).bind(stage.id).all<{ id: number; name: string }>();

        for (let gi = 0; gi < dbGroups.results.length; gi++) {
          const dbGroup = dbGroups.results[gi];
          const drawGroup = draw.groups[gi];
          if (!drawGroup) continue;

          groups.push({ id: dbGroup.id, name: dbGroup.name, team_ids: drawGroup.team_ids });

          const gtStmt = this.env.DB.prepare(
            "INSERT OR IGNORE INTO competition_group_teams (group_id, team_id, seed_position) VALUES (?, ?, ?)"
          );
          const gtBatch = drawGroup.team_ids.map((tid, idx) =>
            gtStmt.bind(dbGroup.id, tid, idx + 1)
          );
          if (gtBatch.length) await this.env.DB.batch(gtBatch);

          const groupRounds = generateFixtures(drawGroup.team_ids);
          const fixStmt = this.env.DB.prepare(
            "INSERT INTO competition_fixtures (competition_id, stage_id, group_id, home_team_id, away_team_id, round_name, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')"
          );
          const fixBatch = groupRounds.flatMap(r =>
            r.matches.map(m =>
              fixStmt.bind(competitionId, stage.id, dbGroup.id, m.home, m.away, `${dbGroup.name} - Week ${r.week}`)
            )
          );
          if (fixBatch.length) await this.env.DB.batch(fixBatch);
          totalFixtures += fixBatch.length;

          for (const tid of drawGroup.team_ids) {
            await this.env.DB.prepare(
              "INSERT OR IGNORE INTO competition_standings (competition_id, stage_id, group_id, team_id) VALUES (?, ?, ?, ?)"
            ).bind(competitionId, stage.id, dbGroup.id, tid).run();
          }
        }

        if (!isLastStage && stage.teams_advancing > 0 && stages.results[si + 1]) {
          break;
        }
      }

      await this.env.DB.prepare(
        "UPDATE competition_stages SET status = 'active' WHERE id = ?"
      ).bind(stage.id).run();
    }

    await this.env.DB.prepare(
      "UPDATE competitions SET status = 'active' WHERE id = ?"
    ).bind(competitionId).run();

    return { success: true, fixturesCount: totalFixtures };
  }

  async getCompetitionFixtures(competitionId: number, stageId?: number): Promise<Array<Record<string, unknown>>> {
    let sql = `SELECT cf.*, ht.name as home_team_name, at.name as away_team_name,
               cg.name as group_name
               FROM competition_fixtures cf
               JOIN teams ht ON cf.home_team_id = ht.id
               JOIN teams at ON cf.away_team_id = at.id
               LEFT JOIN competition_groups cg ON cf.group_id = cg.id
               WHERE cf.competition_id = ?`;
    const bindings: (string | number)[] = [competitionId];
    if (stageId) {
      sql += " AND cf.stage_id = ?";
      bindings.push(stageId);
    }
    sql += " ORDER BY cf.stage_id, cf.round_name, cf.leg, cf.id";

    const result = await this.env.DB.prepare(sql).bind(...bindings).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async getCompetitionStandings(competitionId: number, stageId?: number): Promise<Array<Record<string, unknown>>> {
    let sql = `SELECT cs.*, t.name as team_name, t.abbreviation, cg.name as group_name
               FROM competition_standings cs
               JOIN teams t ON cs.team_id = t.id
               LEFT JOIN competition_groups cg ON cs.group_id = cg.id
               WHERE cs.competition_id = ?`;
    const bindings: (string | number)[] = [competitionId];
    if (stageId) {
      sql += " AND cs.stage_id = ?";
      bindings.push(stageId);
    }
    sql += " ORDER BY cs.group_id, cs.points DESC, cs.goal_difference DESC, cs.goals_for DESC";

    const result = await this.env.DB.prepare(sql).bind(...bindings).all();
    return result.results as Array<Record<string, unknown>>;
  }

  async advanceCompetitionWeek(
    competitionId: number,
    leagueId: string
  ): Promise<{ success: boolean; results?: Array<Record<string, unknown>>; error?: string }> {
    if (!this.state) throw new Error("League not initialized");

    const config = await this.loadConfig(leagueId);

    const unplayedFixtures = await this.env.DB.prepare(
      `SELECT cf.*, ht.name as home_team_name, at.name as away_team_name
       FROM competition_fixtures cf
       JOIN teams ht ON cf.home_team_id = ht.id
       JOIN teams at ON cf.away_team_id = at.id
       WHERE cf.competition_id = ? AND cf.status = 'scheduled' AND cf.match_id IS NULL
       ORDER BY cf.stage_id, cf.round_name, cf.leg, cf.id
       LIMIT 20`
    ).bind(competitionId).all<{
      id: number; stage_id: number; group_id: number | null;
      home_team_id: number; away_team_id: number; round_name: string;
      leg: number; bracket_position: number | null;
      home_team_name: string; away_team_name: string;
    }>();

    if (!unplayedFixtures.results?.length) {
      return { success: false, error: "No unplayed fixtures" };
    }

    const firstStage = unplayedFixtures.results[0].stage_id;
    const firstRound = unplayedFixtures.results[0].round_name;
    const firstLeg = unplayedFixtures.results[0].leg;
    const weekFixtures = unplayedFixtures.results.filter(
      f => f.stage_id === firstStage && f.round_name === firstRound && f.leg === firstLeg
    );

    const matchResults: Array<Record<string, unknown>> = [];

    for (const fixture of weekFixtures) {
      const homePlayers = await this.env.DB.prepare(
        "SELECT * FROM players WHERE team_id = ?"
      ).bind(fixture.home_team_id).all();
      const awayPlayers = await this.env.DB.prepare(
        "SELECT * FROM players WHERE team_id = ?"
      ).bind(fixture.away_team_id).all();
      const homeRoster = homePlayers.results as unknown as Player[];
      const awayRoster = awayPlayers.results as unknown as Player[];
      if (!homeRoster.length || !awayRoster.length) continue;

      const homeResolved = await this.resolveTeamLineup(fixture.home_team_id, homeRoster);
      const awayResolved = await this.resolveTeamLineup(fixture.away_team_id, awayRoster);

      const matchResult = simulateMatch(
        homeRoster, awayRoster,
        homeResolved.lineup, awayResolved.lineup,
        homeResolved.tactic, awayResolved.tactic,
        fixture.home_team_name, fixture.away_team_name,
        homeResolved.conditionals, awayResolved.conditionals,
        homeResolved.penaltyTaker, awayResolved.penaltyTaker,
        config
      );

      const matchInsert = await this.env.DB.prepare(
        `INSERT INTO matches (home_team_id, away_team_id, home_tactic, away_tactic,
          home_lineup, away_lineup, home_conditionals, away_conditionals,
          status, home_score, away_score, commentary, match_events, played_at, league_id,
          home_stats, away_stats, home_possession, away_possession)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'played', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        fixture.home_team_id, fixture.away_team_id,
        homeResolved.tactic, awayResolved.tactic,
        JSON.stringify(homeResolved.lineup), JSON.stringify(awayResolved.lineup),
        JSON.stringify(homeResolved.conditionals), JSON.stringify(awayResolved.conditionals),
        matchResult.home_score, matchResult.away_score,
        matchResult.commentary, JSON.stringify(matchResult.events),
        new Date().toISOString(), leagueId,
        JSON.stringify(matchResult.home_stats.map(formatPlayerStats)),
        JSON.stringify(matchResult.away_stats.map(formatPlayerStats)),
        matchResult.home_possession, matchResult.away_possession
      ).run();

      const matchId = matchInsert.meta.last_row_id;
      await this.env.DB.prepare(
        "UPDATE competition_fixtures SET match_id = ?, status = 'played' WHERE id = ?"
      ).bind(matchId, fixture.id).run();

      for (const stat of matchResult.home_stats) {
        const player = homeRoster.find(p => p.id === stat.player_id);
        if (player) await this.applyStats(player, stat, config);
      }
      for (const stat of matchResult.away_stats) {
        const player = awayRoster.find(p => p.id === stat.player_id);
        if (player) await this.applyStats(player, stat, config);
      }

      await this.updateCompetitionStandings(
        competitionId, fixture.stage_id, fixture.group_id,
        fixture.home_team_id, fixture.away_team_id,
        matchResult.home_score, matchResult.away_score
      );

      matchResults.push({
        home: fixture.home_team_name,
        away: fixture.away_team_name,
        home_score: matchResult.home_score,
        away_score: matchResult.away_score,
      });
    }

    const remainingInStage = await this.env.DB.prepare(
      "SELECT COUNT(*) as count FROM competition_fixtures WHERE stage_id = ? AND status = 'scheduled'"
    ).bind(firstStage).first<{ count: number }>();

    if (!remainingInStage || remainingInStage.count === 0) {
      await this.env.DB.prepare(
        "UPDATE competition_stages SET status = 'completed' WHERE id = ?"
      ).bind(firstStage).run();

      await this.tryGenerateNextStage(competitionId, leagueId);
    }

    return { success: true, results: matchResults };
  }

  private async tryGenerateNextStage(competitionId: number, leagueId: string): Promise<void> {
    const stages = await this.env.DB.prepare(
      "SELECT * FROM competition_stages WHERE competition_id = ? ORDER BY stage_order"
    ).bind(competitionId).all<{
      id: number; name: string; stage_order: number; format: string;
      num_groups: number; teams_advancing: number; num_legs: number; status: string;
    }>();

    const completedIdx = stages.results.findIndex(s => s.status === 'completed');
    if (completedIdx < 0) return;

    const completedStage = stages.results[completedIdx];
    const nextStage = stages.results[completedIdx + 1];
    if (!nextStage) {
      const allCompleted = stages.results.every(s => s.status === 'completed');
      if (allCompleted) {
        await this.env.DB.prepare(
          "UPDATE competitions SET status = 'completed' WHERE id = ?"
        ).bind(competitionId).run();
      }
      return;
    }

    let advancingTeams: Array<{ team_id: number }>;

    if (completedStage.format === 'round_robin' || completedStage.format === 'group_knockout') {
      const standings = await this.env.DB.prepare(
        `SELECT cs.group_id, cs.team_id, cs.points, cs.goal_difference, cs.goals_for
         FROM competition_standings cs
         WHERE cs.competition_id = ? AND cs.stage_id = ?
         ORDER BY cs.points DESC, cs.goal_difference DESC, cs.goals_for DESC`
      ).bind(competitionId, completedStage.id).all<{
        group_id: number | null; team_id: number;
        points: number; goal_difference: number; goals_for: number;
      }>();

      if (completedStage.num_groups > 0 && completedStage.teams_advancing > 0) {
        const advancing = getAdvancingFromGroups(
          standings.results.filter((s): s is { group_id: number; team_id: number; points: number; goal_difference: number; goals_for: number } => s.group_id !== null),
          completedStage.teams_advancing
        );
        const seeded = groupAdvancingToKnockoutSeedOrder(advancing);
        advancingTeams = seeded;
      } else {
        const perGroup = completedStage.teams_advancing || standings.results.length;
        advancingTeams = standings.results.slice(0, perGroup).map(s => ({ team_id: s.team_id }));
      }
    } else {
      const playedFixtures = await this.env.DB.prepare(
        `SELECT cf.home_team_id, cf.away_team_id, cf.bracket_position, cf.leg,
                m.home_score, m.away_score
         FROM competition_fixtures cf
         JOIN matches m ON cf.match_id = m.id
         WHERE cf.stage_id = ? AND cf.status = 'played'
         ORDER BY cf.bracket_position, cf.leg`
      ).bind(completedStage.id).all<{
        home_team_id: number; away_team_id: number;
        bracket_position: number | null; leg: number;
        home_score: number; away_score: number;
      }>();

      const aggregateScores = new Map<number, { team_id: number; goals: number; away_goals: number }[]>();

      for (const pf of playedFixtures.results) {
        const bp = pf.bracket_position ?? 0;
        if (!aggregateScores.has(bp)) aggregateScores.set(bp, []);

        const entries = aggregateScores.get(bp)!;
        const homeEntry = entries.find(e => e.team_id === pf.home_team_id);
        const awayEntry = entries.find(e => e.team_id === pf.away_team_id);

        if (homeEntry) {
          homeEntry.goals += pf.home_score;
          homeEntry.away_goals += pf.away_score;
        } else {
          entries.push({ team_id: pf.home_team_id, goals: pf.home_score, away_goals: 0 });
        }
        if (awayEntry) {
          awayEntry.goals += pf.away_score;
          awayEntry.away_goals += pf.home_score;
        } else {
          entries.push({ team_id: pf.away_team_id, goals: pf.away_score, away_goals: pf.home_score });
        }
      }

      advancingTeams = [];
      const sortedBrackets = [...aggregateScores.entries()].sort(([a], [b]) => a - b);
      for (const [, entries] of sortedBrackets) {
        if (entries.length === 2) {
          const [a, b] = entries;
          if (a.goals > b.goals || (a.goals === b.goals && a.away_goals > b.away_goals)) {
            advancingTeams.push({ team_id: a.team_id });
          } else {
            advancingTeams.push({ team_id: b.team_id });
          }
        } else if (entries.length === 1) {
          advancingTeams.push({ team_id: entries[0].team_id });
        }
      }
    }

    if (advancingTeams.length < 2) {
      await this.env.DB.prepare(
        "UPDATE competitions SET status = 'completed' WHERE id = ?"
      ).bind(competitionId).run();
      return;
    }

    if (nextStage.format === 'knockout') {
      const matches = generateNextKnockoutRound(advancingTeams, nextStage.name);
      const stmt = this.env.DB.prepare(
        "INSERT INTO competition_fixtures (competition_id, stage_id, group_id, home_team_id, away_team_id, round_name, bracket_position, status) VALUES (?, ?, NULL, ?, ?, ?, ?, 'scheduled')"
      );
      const batch = matches.map(m =>
        stmt.bind(competitionId, nextStage.id, m.home_team_id, m.away_team_id, nextStage.name, m.bracket_position)
      );
      if (batch.length) await this.env.DB.batch(batch);
    } else if (nextStage.format === 'two_legged_knockout') {
      const matches = generateNextKnockoutRound(advancingTeams, nextStage.name);
      const batch: D1PreparedStatement[] = [];
      const stmt = this.env.DB.prepare(
        "INSERT INTO competition_fixtures (competition_id, stage_id, group_id, home_team_id, away_team_id, round_name, leg, bracket_position, status) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'scheduled')"
      );
      for (const m of matches) {
        batch.push(stmt.bind(competitionId, nextStage.id, m.home_team_id, m.away_team_id, `${nextStage.name} (1st Leg)`, 1, m.bracket_position));
        batch.push(stmt.bind(competitionId, nextStage.id, m.away_team_id, m.home_team_id, `${nextStage.name} (2nd Leg)`, 2, m.bracket_position));
      }
      if (batch.length) await this.env.DB.batch(batch);
    }

    await this.env.DB.prepare(
      "UPDATE competition_stages SET status = 'active' WHERE id = ?"
    ).bind(nextStage.id).run();
  }

  private async updateCompetitionStandings(
    competitionId: number,
    stageId: number,
    groupId: number | null,
    homeId: number,
    awayId: number,
    homeGoals: number,
    awayGoals: number
  ): Promise<void> {
    await this.env.DB.prepare(
      "INSERT OR IGNORE INTO competition_standings (competition_id, stage_id, group_id, team_id) VALUES (?, ?, ?, ?)"
    ).bind(competitionId, stageId, groupId, homeId).run();
    await this.env.DB.prepare(
      "INSERT OR IGNORE INTO competition_standings (competition_id, stage_id, group_id, team_id) VALUES (?, ?, ?, ?)"
    ).bind(competitionId, stageId, groupId, awayId).run();

    if (homeGoals > awayGoals) {
      await this.env.DB.prepare(
        "UPDATE competition_standings SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE competition_id = ? AND stage_id = ? AND group_id IS ? AND team_id = ?"
      ).bind(homeGoals, awayGoals, homeGoals - awayGoals, competitionId, stageId, groupId, homeId).run();
      await this.env.DB.prepare(
        "UPDATE competition_standings SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE competition_id = ? AND stage_id = ? AND group_id IS ? AND team_id = ?"
      ).bind(awayGoals, homeGoals, awayGoals - homeGoals, competitionId, stageId, groupId, awayId).run();
    } else if (awayGoals > homeGoals) {
      await this.env.DB.prepare(
        "UPDATE competition_standings SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE competition_id = ? AND stage_id = ? AND group_id IS ? AND team_id = ?"
      ).bind(awayGoals, homeGoals, awayGoals - homeGoals, competitionId, stageId, groupId, awayId).run();
      await this.env.DB.prepare(
        "UPDATE competition_standings SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE competition_id = ? AND stage_id = ? AND group_id IS ? AND team_id = ?"
      ).bind(homeGoals, awayGoals, homeGoals - awayGoals, competitionId, stageId, groupId, homeId).run();
    } else {
      await this.env.DB.prepare(
        "UPDATE competition_standings SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE competition_id = ? AND stage_id = ? AND group_id IS ? AND team_id = ?"
      ).bind(homeGoals, awayGoals, 0, competitionId, stageId, groupId, homeId).run();
      await this.env.DB.prepare(
        "UPDATE competition_standings SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE competition_id = ? AND stage_id = ? AND group_id IS ? AND team_id = ?"
      ).bind(awayGoals, homeGoals, 0, competitionId, stageId, groupId, awayId).run();
    }
  }

  private async resolveTeamLineup(teamId: number, roster: Player[]): Promise<{
    lineup: Array<{ position: string; player_id: number; name: string; is_sub: boolean; sub_order: number }>;
    tactic: string;
    conditionals: ConditionalInstruction[];
    penaltyTaker: string | null;
  }> {
    const saved = await this.env.DB.prepare(
      'SELECT * FROM team_saved_lineups WHERE team_id = ? AND is_active = 1'
    ).bind(teamId).first<{
      id: number; formation: string; tactic_code: string; lineup: string; conditionals: string; penalty_taker_id: number | null;
    }>();

    if (saved) {
      const lineupData = JSON.parse(saved.lineup || '[]') as Array<{
        position: string; player_id: number; name: string; is_sub: boolean; sub_order: number;
      }>;
      const filtered = lineupData.filter(lp => roster.some(p => p.id === lp.player_id && p.injury === 0 && p.suspension === 0));

      const condRaw: string[] = [];
      try {
        const parsed = JSON.parse(saved.conditionals || '[]');
        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            condRaw.push(typeof c === 'string' ? c : (c as { raw?: string }).raw || JSON.stringify(c));
          }
        }
      } catch {}

      let penaltyTaker: string | null = null;
      if (saved.penalty_taker_id) {
        const pt = roster.find(p => p.id === saved.penalty_taker_id);
        if (pt) penaltyTaker = pt.name;
      }
      if (!penaltyTaker) {
        const starters = filtered.filter(p => !p.is_sub);
        let bestSh = -1;
        for (const s of starters) {
          const player = roster.find(p => p.id === s.player_id);
          if (player && player.sh > bestSh) {
            bestSh = player.sh;
            penaltyTaker = player.name;
          }
        }
      }

      return {
        lineup: filtered,
        tactic: saved.tactic_code,
        conditionals: parseConditionals(condRaw),
        penaltyTaker,
      };
    }

    const team = await this.env.DB.prepare('SELECT default_formation, default_tactic FROM teams WHERE id = ?').bind(teamId).first<{ default_formation: string; default_tactic: string }>();
    const formation = team?.default_formation || '442';
    const tactic = team?.default_tactic || 'N';
    const sheet = createTeamsheet(roster, `${formation}${tactic}`, '', 5);
    const { lineup, penalty_taker } = teamsheetToLineup(sheet);
    return { lineup, tactic: sheet.tactic, conditionals: [], penaltyTaker: penalty_taker };
  }

  private async loadConfig(leagueId: string): Promise<LeagueConfig> {
    try {
      const configMap = await this.getLeagueConfig(leagueId);
      if (Object.keys(configMap).length > 0) {
        return configToLeagueConfig(configMap);
      }
    } catch {
      /* use defaults */
    }
    return DEFAULT_CONFIG;
  }

  private async applyStats(
    player: Player,
    stat: SimPlayer,
    config: LeagueConfig
  ) {
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
    const dp =
      player.dp +
      (stat.yellowcards || 0) * config.dp_for_yellow +
      (stat.redcards || 0) * config.dp_for_red;
    let suspension = player.suspension;
    const oldThreshold = Math.floor(player.dp / config.suspension_margin);
    const newThreshold = Math.floor(dp / config.suspension_margin);
    if (newThreshold > oldThreshold && suspension === 0) {
      suspension = newThreshold;
    }

    const fitness = Math.max(
      0,
      Math.round((1 - (stat.fatigue || 0)) * 100)
    );

    await this.env.DB.prepare(
      "UPDATE players SET games = ?, saves = ?, tackles = ?, keypasses = ?, shots = ?, goals = ?, assists = ?, dp = ?, injury = ?, suspension = ?, st_ab = ?, tk_ab = ?, ps_ab = ?, sh_ab = ?, st = ?, tk = ?, ps = ?, sh = ?, fitness = ? WHERE id = ?"
    )
      .bind(
        games,
        player.saves + (stat.saves || 0),
        player.tackles + (stat.tackles || 0),
        player.keypasses + (stat.keypasses || 0),
        player.shots + (stat.shots || 0),
        player.goals + (stat.goals || 0),
        player.assists + (stat.assists || 0),
        dp,
        injury,
        suspension,
        st_ab,
        tk_ab,
        ps_ab,
        sh_ab,
        st,
        tk,
        ps,
        sh,
        fitness,
        player.id
      )
      .run();
  }

  private async updateLeagueForMatch(
    homeId: number,
    awayId: number,
    homeGoals: number,
    awayGoals: number,
    leagueId: string
  ) {
    const season = this.state?.season ?? 1;
    await this.env.DB.prepare(
      "INSERT OR IGNORE INTO league_table (team_id, season, league_id) VALUES (?, ?, ?)"
    )
      .bind(homeId, season, leagueId)
      .run();
    await this.env.DB.prepare(
      "INSERT OR IGNORE INTO league_table (team_id, season, league_id) VALUES (?, ?, ?)"
    )
      .bind(awayId, season, leagueId)
      .run();

    if (homeGoals > awayGoals) {
      await this.env.DB.prepare(
        "UPDATE league_table SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(homeGoals, awayGoals, homeGoals - awayGoals, homeId, season, leagueId)
        .run();
      await this.env.DB.prepare(
        "UPDATE league_table SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(awayGoals, homeGoals, awayGoals - homeGoals, awayId, season, leagueId)
        .run();
    } else if (awayGoals > homeGoals) {
      await this.env.DB.prepare(
        "UPDATE league_table SET played = played + 1, won = won + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 3 WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(awayGoals, homeGoals, awayGoals - homeGoals, awayId, season, leagueId)
        .run();
      await this.env.DB.prepare(
        "UPDATE league_table SET played = played + 1, lost = lost + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ? WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(homeGoals, awayGoals, homeGoals - awayGoals, homeId, season, leagueId)
        .run();
    } else {
      await this.env.DB.prepare(
        "UPDATE league_table SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(homeGoals, awayGoals, 0, homeId, season, leagueId)
        .run();
      await this.env.DB.prepare(
        "UPDATE league_table SET played = played + 1, drawn = drawn + 1, goals_for = goals_for + ?, goals_against = goals_against + ?, goal_difference = goal_difference + ?, points = points + 1 WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(awayGoals, homeGoals, 0, awayId, season, leagueId)
        .run();
    }
  }

  private async reverseLeagueTable(
    homeId: number,
    awayId: number,
    homeGoals: number,
    awayGoals: number,
    leagueId: string,
    season: number
  ) {
    if (homeGoals > awayGoals) {
      await this.env.DB.prepare(
        "UPDATE league_table SET played = MAX(played - 1, 0), won = MAX(won - 1, 0), goals_for = MAX(goals_for - ?, 0), goals_against = MAX(goals_against - ?, 0), goal_difference = goal_difference - ?, points = MAX(points - 3, 0) WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(homeGoals, awayGoals, homeGoals - awayGoals, homeId, season, leagueId)
        .run();
      await this.env.DB.prepare(
        "UPDATE league_table SET played = MAX(played - 1, 0), lost = MAX(lost - 1, 0), goals_for = MAX(goals_for - ?, 0), goals_against = MAX(goals_against - ?, 0), goal_difference = goal_difference - ? WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(awayGoals, homeGoals, awayGoals - homeGoals, awayId, season, leagueId)
        .run();
    } else if (awayGoals > homeGoals) {
      await this.env.DB.prepare(
        "UPDATE league_table SET played = MAX(played - 1, 0), won = MAX(won - 1, 0), goals_for = MAX(goals_for - ?, 0), goals_against = MAX(goals_against - ?, 0), goal_difference = goal_difference - ?, points = MAX(points - 3, 0) WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(awayGoals, homeGoals, awayGoals - homeGoals, awayId, season, leagueId)
        .run();
      await this.env.DB.prepare(
        "UPDATE league_table SET played = MAX(played - 1, 0), lost = MAX(lost - 1, 0), goals_for = MAX(goals_for - ?, 0), goals_against = MAX(goals_against - ?, 0), goal_difference = goal_difference - ? WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(homeGoals, awayGoals, homeGoals - awayGoals, homeId, season, leagueId)
        .run();
    } else {
      await this.env.DB.prepare(
        "UPDATE league_table SET played = MAX(played - 1, 0), drawn = MAX(drawn - 1, 0), goals_for = MAX(goals_for - ?, 0), goals_against = MAX(goals_against - ?, 0), goal_difference = goal_difference - ?, points = MAX(points - 1, 0) WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(homeGoals, awayGoals, 0, homeId, season, leagueId)
        .run();
      await this.env.DB.prepare(
        "UPDATE league_table SET played = MAX(played - 1, 0), drawn = MAX(drawn - 1, 0), goals_for = MAX(goals_for - ?, 0), goals_against = MAX(goals_against - ?, 0), goal_difference = goal_difference - ?, points = MAX(points - 1, 0) WHERE team_id = ? AND season = ? AND league_id = ?"
      )
        .bind(awayGoals, homeGoals, 0, awayId, season, leagueId)
        .run();
    }
  }
}
