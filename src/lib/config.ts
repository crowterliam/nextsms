// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Configuration parsing and league table logic ported from ESMS
// (Electronic Soccer Management Simulator) by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/config.cpp, src/league_table.cpp

import type { LeagueConfig } from './types';

export function parseConfig(text: string): Record<string, string> {
  const config: Record<string, string> = {};
  let inAbbr = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    if (line.toLowerCase().startsWith('abbreviations')) {
      inAbbr = true;
      continue;
    }
    if (line.toLowerCase().startsWith('abilities')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    let key = line.substring(0, eqIdx).trim();
    const value = line.substring(eqIdx + 1).trim();

    if (inAbbr) {
      key = `abbr_${key}`;
    } else {
      key = key.toUpperCase();
    }
    config[key] = value;
  }
  return config;
}

export function configToLeagueConfig(config: Record<string, string>): LeagueConfig {
  const get = (k: string, def: number) => {
    const v = config[k];
    return v !== undefined ? parseInt(v, 10) : def;
  };
  return {
    home_bonus: get('HOME_BONUS', 200),
    dp_for_yellow: get('DP_FOR_YELLOW', 4),
    dp_for_red: get('DP_FOR_RED', 10),
    suspension_margin: get('SUSPENSION_MARGIN', 10),
    max_injury_length: get('MAX_INJURY_LENGTH', 9),
    num_subs: get('NUM_SUBS', 5),
    substitutions: get('SUBSTITUTIONS', 3),
    updtr_fitness_gain: get('UPDTR_FITNESS_GAIN', 20),
    updtr_fitness_after_injury: get('UPDTR_FITNESS_AFTER_INJURY', 80),
    AB_Goal: get('AB_GOAL', 50),
    AB_Assist: get('AB_ASSIST', 35),
    AB_Victory_Random: get('AB_VICTORY_RANDOM', 60),
    AB_Clean_Sheet: get('AB_CLEAN_SHEET', 50),
    AB_Ktk: get('AB_KTK', 18),
    AB_Kps: get('AB_KPS', 12),
    AB_Sht_On: get('AB_SHT_ON', 2),
    AB_Sht_Off: get('AB_SHT_OFF', 0),
    AB_Sav: get('AB_SAV', 12),
    AB_Defeat_Random: get('AB_DEFEAT_RANDOM', -60),
    AB_Concede: get('AB_CONCEDE', -8),
    AB_Yellow: get('AB_YELLOW', -8),
    AB_Red: get('AB_RED', -20),
  };
}

export interface TeamLeagueData {
  team_id: number;
  name: string;
  abbreviation: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export function updateLeagueTable(
  entries: TeamLeagueData[],
  homeTeamId: number,
  awayTeamId: number,
  homeGoals: number,
  awayGoals: number
): TeamLeagueData[] {
  const updated = entries.map((e) => ({ ...e }));

  const home = updated.find((e) => e.team_id === homeTeamId);
  const away = updated.find((e) => e.team_id === awayTeamId);
  if (!home || !away) return updated;

  home.played++;
  away.played++;
  home.goals_for += homeGoals;
  home.goals_against += awayGoals;
  away.goals_for += awayGoals;
  away.goals_against += homeGoals;
  home.goal_difference = home.goals_for - home.goals_against;
  away.goal_difference = away.goals_for - away.goals_against;

  if (homeGoals > awayGoals) {
    home.won++;
    home.points += 3;
    away.lost++;
  } else if (homeGoals < awayGoals) {
    away.won++;
    away.points += 3;
    home.lost++;
  } else {
    home.drawn++;
    away.drawn++;
    home.points += 1;
    away.points += 1;
  }

  return sortLeagueTable(updated);
}

export function sortLeagueTable(entries: TeamLeagueData[]): TeamLeagueData[] {
  return entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    return b.goals_for - a.goals_for;
  });
}

export function parseResultLine(line: string): { home: string; away: string; homeGoals: number; awayGoals: number } | null {
  const match = line.match(/^\s*(\S+)\s+(\d+)\s*-\s*(\d+)\s+(\S+)\s*$/);
  if (!match) return null;
  return {
    home: match[1],
    away: match[4],
    homeGoals: parseInt(match[2], 10),
    awayGoals: parseInt(match[3], 10),
  };
}
