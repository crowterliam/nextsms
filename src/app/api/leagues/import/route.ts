import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth, getLeagueDO } from '@/lib/auth-helpers';
import {
  parseLegacyRoster,
  parseLegacyConfig,
  parseLegacyFixtures,
  parseLegacyTable,
  parseLegacyTeams,
} from '@/lib/legacy-parser';
import type { LegacyRosterPlayer, LegacyFixtureWeek, LegacyTableEntry } from '@/lib/legacy-parser';

export const runtime = 'edge';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROSTER_FILES = 20;
const MAX_PLAYERS_PER_TEAM = 50;
const MAX_FIXTURES = 1000;

export async function POST(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const formData = await request.formData();
  const leagueName = (formData.get('leagueName') as string || '').trim();
  const leagueSlug = (formData.get('leagueSlug') as string || '').trim();
  const configFile = formData.get('config') as File | null;
  const rosterFiles = formData.getAll('rosters') as File[];
  const fixturesFile = formData.get('fixtures') as File | null;
  const tableFile = formData.get('table') as File | null;

  if (!leagueName || !leagueSlug) {
    return NextResponse.json({ error: 'leagueName and leagueSlug required' }, { status: 400 });
  }

  if (!/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/.test(leagueSlug)) {
    return NextResponse.json({ error: 'League slug must be 2-50 chars, lowercase alphanumeric and hyphens only' }, { status: 400 });
  }

  if (leagueName.length > 100) {
    return NextResponse.json({ error: 'League name must be 100 characters or less' }, { status: 400 });
  }

  if (rosterFiles.length > MAX_ROSTER_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_ROSTER_FILES} roster files allowed` }, { status: 400 });
  }

  for (const file of [configFile, fixturesFile, tableFile, ...rosterFiles]) {
    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File "${file.name}" exceeds 5 MB limit` }, { status: 413 });
    }
  }

  const env = getEnv();

  const existing = await env.DB.prepare('SELECT id FROM leagues WHERE slug = ?').bind(leagueSlug).first();
  if (existing) {
    return NextResponse.json({ error: 'League slug already taken' }, { status: 409 });
  }

  const leagueId = crypto.randomUUID();

  try {
    return await doImport(env, user!, leagueId, leagueName, leagueSlug, configFile, rosterFiles, fixturesFile, tableFile);
  } catch (err) {
    await env.DB.prepare('DELETE FROM league_members WHERE league_id = ?').bind(leagueId).run().catch(() => {});
    await env.DB.prepare('DELETE FROM leagues WHERE id = ?').bind(leagueId).run().catch(() => {});
    return NextResponse.json({ error: 'Import failed: ' + (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

async function doImport(
  env: CloudflareEnv,
  user: { id: string },
  leagueId: string,
  leagueName: string,
  leagueSlug: string,
  configFile: File | null,
  rosterFiles: File[],
  fixturesFile: File | null,
  tableFile: File | null,
) {
  await env.DB.prepare('INSERT INTO leagues (id, name, slug, owner_id) VALUES (?, ?, ?, ?)')
    .bind(leagueId, leagueName, leagueSlug, user.id)
    .run();
  await env.DB.prepare('INSERT INTO league_members (league_id, user_id, role) VALUES (?, ?, ?)')
    .bind(leagueId, user.id, 'owner')
    .run();

  const doStub = getLeagueDO(leagueSlug);
  await doStub.init(leagueName, leagueSlug);

  let abbreviations: Record<string, string> = {};
  let importedTeams = 0;
  let importedPlayers = 0;
  let importedFixtures = 0;
  let importedConfig = false;
  let importedTable = false;
  const warnings: string[] = [];

  if (configFile) {
    const configText = await configFile.text();
    const parsed = parseLegacyConfig(configText);
    abbreviations = parsed.abbreviations;

    if (Object.keys(parsed.config).length > 0) {
      const configEntries: Array<[string, string]> = [];
      const keyMap: Record<string, string> = {
        'HOME_BONUS': 'HOME_BONUS',
        'DP_FOR_YELLOW': 'DP_FOR_YELLOW',
        'DP_FOR_RED': 'DP_FOR_RED',
        'SUSPENSION_MARGIN': 'SUSPENSION_MARGIN',
        'MAX_INJURY_LENGTH': 'MAX_INJURY_LENGTH',
        'NUM_SUBS': 'NUM_SUBS',
        'SUBSTITUTIONS': 'SUBSTITUTIONS',
        'UPDTR_FITNESS_GAIN': 'UPDTR_FITNESS_GAIN',
        'UPDTR_FITNESS_AFTER_INJURY': 'UPDTR_FITNESS_AFTER_INJURY',
        'AB_GOAL': 'AB_GOAL',
        'AB_ASSIST': 'AB_ASSIST',
        'AB_VICTORY_RANDOM': 'AB_VICTORY_RANDOM',
        'AB_CLEAN_SHEET': 'AB_CLEAN_SHEET',
        'AB_KTK': 'AB_KTK',
        'AB_KPS': 'AB_KPS',
        'AB_SHT_ON': 'AB_SHT_ON',
        'AB_SHT_OFF': 'AB_SHT_OFF',
        'AB_SAV': 'AB_SAV',
        'AB_DEFEAT_RANDOM': 'AB_DEFEAT_RANDOM',
        'AB_CONCEDE': 'AB_CONCEDE',
        'AB_YELLOW': 'AB_YELLOW',
        'AB_RED': 'AB_RED',
      };

      for (const [key, value] of Object.entries(parsed.config)) {
        if (keyMap[key]) {
          const num = parseFloat(value as string);
          if (isNaN(num)) {
            warnings.push(`Config ${key} has non-numeric value "${value}", skipped`);
            continue;
          }
          configEntries.push([keyMap[key], String(num)]);
        }
      }

      if (configEntries.length > 0) {
        await doStub.updateLeagueConfig(leagueId, Object.fromEntries(configEntries));
        importedConfig = true;
      }
    }
  }

  if (rosterFiles.length > 0) {
    for (const file of rosterFiles) {
      const text = await file.text();
      let abbr = file.name.replace(/\.txt$/i, '').toLowerCase();

      const parsed = parseLegacyRoster(text);
      const fullname = abbreviations[abbr] || abbr;

      const teamResult = await doStub.addTeam(fullname.replace(/_/g, ' '), abbr.toUpperCase(), leagueId, undefined, true);
      if (!teamResult.success || !teamResult.team) {
        warnings.push(`Skipped team ${abbr}: already exists or failed to create`);
        continue;
      }

      const teamId = teamResult.team.id;

      if (parsed.players.length > MAX_PLAYERS_PER_TEAM) {
        warnings.push(`Team ${abbr}: truncated to ${MAX_PLAYERS_PER_TEAM} players (had ${parsed.players.length})`);
        parsed.players = parsed.players.slice(0, MAX_PLAYERS_PER_TEAM);
      }

      if (parsed.players.length > 0) {
        const stmt = env.DB.prepare(
          'INSERT INTO players (team_id, name, age, nationality, pref_side, st, tk, ps, sh, sm, ag, st_ab, tk_ab, ps_ab, sh_ab, games, saves, tackles, keypasses, shots, goals, assists, dp, injury, suspension, fitness, league_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const batch = parsed.players.map((p) =>
          stmt.bind(teamId, p.name, p.age, p.nationality, p.pref_side, p.st, p.tk, p.ps, p.sh, p.sm, p.ag, p.st_ab, p.tk_ab, p.ps_ab, p.sh_ab, p.games, p.saves, p.tackles, p.keypasses, p.shots, p.goals, p.assists, p.dp, p.injury, p.suspension, p.fitness, leagueId)
        );
        await env.DB.batch(batch);
        importedPlayers += parsed.players.length;
      }

      importedTeams++;
    }
  }

  if (fixturesFile) {
    const fixturesText = await fixturesFile.text();
    const parsedFixtures = parseLegacyFixtures(fixturesText);

    if (parsedFixtures.length > 0) {
      const teams = await env.DB.prepare('SELECT id, name, abbreviation FROM teams WHERE league_id = ?').bind(leagueId).all();
      const teamMap = new Map<string, number>();
      for (const t of (teams.results as Array<{ id: number; name: string; abbreviation: string }>)) {
        teamMap.set(t.name.toLowerCase(), t.id);
        teamMap.set(t.abbreviation.toLowerCase(), t.id);
        const underscoreName = t.name.replace(/\s+/g, '_').toLowerCase();
        teamMap.set(underscoreName, t.id);
      }

      const stmt = env.DB.prepare(
        'INSERT INTO fixtures (season, week, home_team_id, away_team_id, league_id) VALUES (?, ?, ?, ?, ?)'
      );
      const batch: ReturnType<typeof stmt.bind>[] = [];

      for (const week of parsedFixtures) {
        for (const match of week.matches) {
          const homeId = teamMap.get(match.home.toLowerCase()) || teamMap.get(match.home.replace(/\s+/g, '_').toLowerCase());
          const awayId = teamMap.get(match.away.toLowerCase()) || teamMap.get(match.away.replace(/\s+/g, '_').toLowerCase());

          if (homeId && awayId) {
            if (importedFixtures < MAX_FIXTURES) {
              batch.push(stmt.bind(1, week.week, homeId, awayId, leagueId));
            }
            importedFixtures++;
          } else {
            warnings.push(`Fixture skipped: ${match.home} vs ${match.away} (team not found)`);
          }
        }
      }

      if (batch.length > 0) await env.DB.batch(batch);
    }
  }

  if (tableFile) {
    const tableText = await tableFile.text();
    const parsedTable = parseLegacyTable(tableText);

    if (parsedTable.length > 0) {
      const teams = await env.DB.prepare('SELECT id, name FROM teams WHERE league_id = ?').bind(leagueId).all();
      const teamMap = new Map<string, number>();
      for (const t of (teams.results as Array<{ id: number; name: string }>)) {
        teamMap.set(t.name.toLowerCase(), t.id);
        teamMap.set(t.name.replace(/\s+/g, '_').toLowerCase(), t.id);
      }

      const stmt = env.DB.prepare(
        'INSERT OR REPLACE INTO league_table (team_id, season, league_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const batch: ReturnType<typeof stmt.bind>[] = [];

      for (const entry of parsedTable) {
        const teamId = teamMap.get(entry.team.toLowerCase()) || teamMap.get(entry.team.replace(/\s+/g, '_').toLowerCase());
        if (teamId) {
          batch.push(stmt.bind(teamId, leagueId, entry.played, entry.won, entry.drawn, entry.lost, entry.goals_for, entry.goals_against, entry.goal_difference, entry.points));
        } else {
          warnings.push(`Table entry skipped: ${entry.team} (team not found)`);
        }
      }

      if (batch.length > 0) {
        await env.DB.batch(batch);
        importedTable = true;
      }
    }
  }

  if (importedTeams > 0) {
    await doStub.startNewSeason(leagueId);
  }

  return NextResponse.json({
    success: true,
    league: { id: leagueId, name: leagueName, slug: leagueSlug },
    imported: {
      teams: importedTeams,
      players: importedPlayers,
      fixtures: importedFixtures,
      config: importedConfig,
      table: importedTable,
    },
    warnings,
  });
}
