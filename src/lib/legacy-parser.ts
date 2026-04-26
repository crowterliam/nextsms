export interface LegacyRosterPlayer {
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
  st_ab: number;
  tk_ab: number;
  ps_ab: number;
  sh_ab: number;
  games: number;
  saves: number;
  tackles: number;
  keypasses: number;
  shots: number;
  goals: number;
  assists: number;
  dp: number;
  injury: number;
  suspension: number;
  fitness: number;
}

export interface LegacyConfig {
  [key: string]: string;
}

export interface LegacyFixtureMatch {
  home: string;
  away: string;
}

export interface LegacyFixtureWeek {
  week: number;
  matches: LegacyFixtureMatch[];
}

export interface LegacyTableEntry {
  place: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface LegacyLeagueData {
  config: LegacyConfig;
  abbreviations: Record<string, string>;
  rosters: Record<string, { abbreviation: string; fullname: string; players: LegacyRosterPlayer[] }>;
  fixtures: LegacyFixtureWeek[];
  table: LegacyTableEntry[];
}

export function parseLegacyRoster(text: string): { abbreviation: string; players: LegacyRosterPlayer[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) throw new Error('Roster file too short');

  const players: LegacyRosterPlayer[] = [];
  for (let i = 2; i < lines.length; i++) {
    const tokens = lines[i].trim().split(/\s+/);
    if (tokens.length < 25) continue;

    const player: LegacyRosterPlayer = {
      name: tokens[0],
      age: parseInt(tokens[1]) || 20,
      nationality: tokens[2],
      pref_side: tokens[3],
      st: parseInt(tokens[4]) || 0,
      tk: parseInt(tokens[5]) || 0,
      ps: parseInt(tokens[6]) || 0,
      sh: parseInt(tokens[7]) || 0,
      sm: parseInt(tokens[8]) || 50,
      ag: parseInt(tokens[9]) || 30,
      st_ab: parseInt(tokens[10]) || 300,
      tk_ab: parseInt(tokens[11]) || 300,
      ps_ab: parseInt(tokens[12]) || 300,
      sh_ab: parseInt(tokens[13]) || 300,
      games: parseInt(tokens[14]) || 0,
      saves: parseInt(tokens[15]) || 0,
      tackles: parseInt(tokens[16]) || 0,
      keypasses: parseInt(tokens[17]) || 0,
      shots: parseInt(tokens[18]) || 0,
      goals: parseInt(tokens[19]) || 0,
      assists: parseInt(tokens[20]) || 0,
      dp: parseInt(tokens[21]) || 0,
      injury: parseInt(tokens[22]) || 0,
      suspension: parseInt(tokens[23]) || 0,
      fitness: parseInt(tokens[24]) || 100,
    };
    players.push(player);
  }

  return { abbreviation: '', players };
}

export function parseLegacyConfig(text: string): { config: LegacyConfig; abbreviations: Record<string, string> } {
  const config: LegacyConfig = {};
  const abbreviations: Record<string, string> = {};
  let abbrMode = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[\s\r]/g, '');
    if (!line) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      const upper = line.toUpperCase();
      if (upper === 'ABBREVIATIONS:' || upper === 'ABBREVATIONS:') abbrMode = true;
      continue;
    }

    const key = line.substring(0, eqIdx);
    const value = line.substring(eqIdx + 1);

    if (abbrMode) {
      abbreviations[key] = value;
    } else {
      config[key.toUpperCase()] = value;
    }
  }

  return { config, abbreviations };
}

export function parseLegacyFixtures(text: string): LegacyFixtureWeek[] {
  const weeks: LegacyFixtureWeek[] = [];
  const lines = text.split(/\r?\n/);
  let currentWeek: LegacyFixtureWeek | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const weekMatch = line.match(/^(\d+)\.\s*$/);
    if (weekMatch) {
      if (currentWeek) weeks.push(currentWeek);
      currentWeek = { week: parseInt(weekMatch[1]), matches: [] };
      continue;
    }

    const matchMatch = line.match(/^(.+?)\s+-\s+(.+)$/);
    if (matchMatch && currentWeek) {
      currentWeek.matches.push({
        home: matchMatch[1].trim(),
        away: matchMatch[2].trim(),
      });
    }
  }

  if (currentWeek) weeks.push(currentWeek);
  return weeks;
}

export function parseLegacyTable(text: string): LegacyTableEntry[] {
  const entries: LegacyTableEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    if (tokens.length < 10) continue;

    const place = parseInt(tokens[0]);
    const points = parseInt(tokens[tokens.length - 1]);
    const gd = parseInt(tokens[tokens.length - 2]);
    const ga = parseInt(tokens[tokens.length - 3]);
    const gf = parseInt(tokens[tokens.length - 4]);
    const lost = parseInt(tokens[tokens.length - 5]);
    const drawn = parseInt(tokens[tokens.length - 6]);
    const won = parseInt(tokens[tokens.length - 7]);
    const played = parseInt(tokens[tokens.length - 8]);

    let team = tokens[1];
    for (let j = 2; j <= tokens.length - 9; j++) {
      team += ' ' + tokens[j];
    }

    entries.push({
      place,
      team: team.replace(/_/g, ' '),
      played,
      won,
      drawn,
      lost,
      goals_for: gf,
      goals_against: ga,
      goal_difference: gd,
      points,
    });
  }

  return entries;
}

export function parseLegacyTeams(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
