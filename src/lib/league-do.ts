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

interface LeagueState {
  season: number;
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
        "INSERT INTO players (team_id, name, age, nationality, pref_side, st, tk, ps, sh, sm, ag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
          p.ag
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

      const homeSheet = createTeamsheet(homeRoster, "442N", "", 5);
      const awaySheet = createTeamsheet(awayRoster, "442N", "", 5);
      const homeLineup = teamsheetToLineup(homeSheet);
      const awayLineup = teamsheetToLineup(awaySheet);

      const matchResult = simulateMatch(
        homeRoster,
        awayRoster,
        homeLineup.lineup,
        awayLineup.lineup,
        homeSheet.tactic,
        awaySheet.tactic,
        fixture.home_team_name,
        fixture.away_team_name,
        [],
        [],
        homeLineup.penalty_taker,
        awayLineup.penalty_taker,
        config
      );

      const matchInsert = await this.env.DB.prepare(
        `INSERT INTO matches (home_team_id, away_team_id, home_tactic, away_tactic,
          home_lineup, away_lineup, home_conditionals, away_conditionals,
          status, home_score, away_score, commentary, match_events, played_at, league_id)
         VALUES (?, ?, ?, ?, ?, ?, '[]', '[]', 'played', ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          fixture.home_team_id,
          fixture.away_team_id,
          homeSheet.tactic,
          awaySheet.tactic,
          JSON.stringify(homeLineup.lineup),
          JSON.stringify(awayLineup.lineup),
          matchResult.home_score,
          matchResult.away_score,
          matchResult.commentary,
          JSON.stringify(matchResult.events),
          new Date().toISOString(),
          leagueId
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
      "UPDATE players SET suspension = CASE WHEN suspension > 0 THEN suspension - 1 ELSE 0 END WHERE league_id = ?"
    )
      .bind(leagueId)
      .run();
    await this.env.DB.prepare(
      "UPDATE players SET injury = CASE WHEN injury > 0 THEN injury - 1 ELSE 0 END WHERE league_id = ?"
    )
      .bind(leagueId)
      .run();
    await this.env.DB.prepare(
      "UPDATE players SET fitness = CASE WHEN injury > 0 THEN fitness WHEN fitness + ? > 100 THEN 100 ELSE fitness + ? END WHERE league_id = ?"
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
      "SELECT * FROM matches WHERE league_id = ? ORDER BY created_at DESC LIMIT ?"
    )
      .bind(leagueId, limit)
      .all();
    return result.results as Array<Record<string, unknown>>;
  }

  async getMatch(
    matchId: number
  ): Promise<Record<string, unknown> | null> {
    return this.env.DB.prepare("SELECT * FROM matches WHERE id = ?")
      .bind(matchId)
      .first() as Promise<Record<string, unknown> | null>;
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

    const homeSheet = createTeamsheet(homeRoster, "442N", "", 5);
    const awaySheet = createTeamsheet(awayRoster, "442N", "", 5);
    const homeLineup = teamsheetToLineup(homeSheet);
    const awayLineup = teamsheetToLineup(awaySheet);

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
      homeLineup.lineup,
      awayLineup.lineup,
      homeSheet.tactic,
      awaySheet.tactic,
      homeTeam?.name || "Home",
      awayTeam?.name || "Away",
      [],
      [],
      homeLineup.penalty_taker,
      awayLineup.penalty_taker,
      config,
      seed
    );

    return {
      home_score: matchResult.home_score,
      away_score: matchResult.away_score,
      events: matchResult.events,
      commentary: matchResult.commentary,
      home_tactic: homeSheet.tactic,
      away_tactic: awaySheet.tactic,
      home_starting: homeSheet.starting.map((s) => ({
        position: s.position,
        name: s.player.name,
      })),
      away_starting: awaySheet.starting.map((s) => ({
        position: s.position,
        name: s.player.name,
      })),
    };
  }

  async updateLeagueConfig(
    leagueId: string,
    settings: Record<string, string>
  ): Promise<{ success: boolean }> {
    const stmt = this.env.DB.prepare(
      "INSERT OR REPLACE INTO league_config (key, value, league_id) VALUES (?, ?, ?)"
    );
    const batch = Object.entries(settings).map(([k, v]) =>
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
}
