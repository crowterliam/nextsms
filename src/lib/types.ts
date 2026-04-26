// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Type definitions and data structures ported from ESMS
// (Electronic Soccer Management Simulator) by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/game.h, src/rosterplayer.h

export interface Player {
  id: number;
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

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  created_at: string;
  league_id?: string;
}

export interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
  home_tactic: string;
  away_tactic: string;
  commentary: string;
  match_events: string;
  home_lineup: string;
  away_lineup: string;
  home_conditionals: string;
  away_conditionals: string;
  played_at: string;
  created_at: string;
}

export interface Fixture {
  id: number;
  season: number;
  week: number;
  home_team_id: number;
  away_team_id: number;
  match_id: number | null;
}

export interface LeagueEntry {
  id: number;
  team_id: number;
  season: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface LineupPlayer {
  player_id: number;
  name: string;
  position: string;
  is_sub: boolean;
  sub_order: number;
}

export interface MatchEvent {
  minute: number;
  type: string;
  team: 'home' | 'away';
  player: string;
  detail?: string;
  secondary_player?: string;
  commentary: string;
}

export interface ConditionalInstruction {
  action: {
    type: 'TACTIC' | 'SUB' | 'CHANGEPOS';
    tactic?: string;
    position?: string;
    player_ref?: string;
    player_ref2?: string;
  };
  conditions: Array<{
    type: 'MIN' | 'SCORE' | 'YELLOW' | 'RED' | 'INJ';
    sign: string;
    value?: number;
    position?: string;
    player_ref?: string;
  }>;
}

export interface SimTeam {
  players: SimPlayer[];
  score: number;
  tactic: string;
  aggression: number;
  cond_substitutions_left: number;
  name: string;
  penalty_taker_index: number;
  possession_minutes: number;
}

export interface SimPlayer {
  name: string;
  pos: string;
  side: string;
  pref_side: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  ag: number;
  stamina: number;
  injury: number;
  suspension: number;
  likes_left: boolean;
  likes_right: boolean;
  likes_center: boolean;
  tk_contrib: number;
  ps_contrib: number;
  sh_contrib: number;
  nominal_fatigue_per_minute: number;
  fatigue: number;
  injured: number;
  active: number;
  minutes: number;
  shots: number;
  goals: number;
  saves: number;
  tackles: number;
  keypasses: number;
  assists: number;
  fouls: number;
  yellowcards: number;
  redcards: number;
  shots_on: number;
  shots_off: number;
  conceded: number;
  dp: number;
  st_ab: number;
  tk_ab: number;
  ps_ab: number;
  sh_ab: number;
  player_id: number;
  corners: number;
  offsides: number;
}

export interface SimResult {
  home_score: number;
  away_score: number;
  events: MatchEvent[];
  home_stats: SimPlayer[];
  away_stats: SimPlayer[];
  commentary: string;
  penalties?: {
    home_score: number;
    away_score: number;
    rounds: Array<{
      home_scored: boolean;
      away_scored: boolean;
      home_taker: string;
      away_taker: string;
    }>;
  };
  home_possession: number;
  away_possession: number;
}

export interface LeagueConfig {
  home_bonus: number;
  dp_for_yellow: number;
  dp_for_red: number;
  suspension_margin: number;
  max_injury_length: number;
  num_subs: number;
  substitutions: number;
  updtr_fitness_gain: number;
  updtr_fitness_after_injury: number;
  AB_Goal: number;
  AB_Assist: number;
  AB_Victory_Random: number;
  AB_Clean_Sheet: number;
  AB_Ktk: number;
  AB_Kps: number;
  AB_Sht_On: number;
  AB_Sht_Off: number;
  AB_Sav: number;
  AB_Defeat_Random: number;
  AB_Concede: number;
  AB_Yellow: number;
  AB_Red: number;
}

export interface TeamTactic {
  id: number;
  team_id: number;
  tactic_code: string;
  formation: string;
  aggression: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface SavedLineup {
  id: number;
  team_id: number;
  name: string;
  formation: string;
  tactic_code: string;
  lineup: string;
  conditionals: string;
  penalty_taker_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TransferListing {
  id: number;
  player_id: number;
  from_team_id: number;
  league_id: string | null;
  asking_price: number;
  status: 'active' | 'sold' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface TransferOffer {
  id: number;
  listing_id: number;
  from_team_id: number;
  to_team_id: number;
  player_id: number;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface TransferLog {
  id: number;
  player_id: number;
  player_name: string;
  from_team_id: number;
  from_team_name: string;
  to_team_id: number;
  to_team_name: string;
  league_id: string | null;
  amount: number;
  created_at: string;
}

export const FORMATIONS = [
  '433', '442', '451', '352', '343', '532', '541', '4231', '4141', '4222', '3511', '3412', '31312', '32122',
] as const;

export const TACTIC_OPTIONS = [
  { code: 'N', name: 'Normal' },
  { code: 'D', name: 'Defensive' },
  { code: 'A', name: 'Attacking' },
  { code: 'C', name: 'Counter-Attack' },
  { code: 'L', name: 'Long Ball' },
  { code: 'P', name: 'Passing' },
] as const;

export const DEFAULT_CONFIG: LeagueConfig = {
  home_bonus: 200,
  dp_for_yellow: 4,
  dp_for_red: 10,
  suspension_margin: 10,
  max_injury_length: 9,
  num_subs: 5,
  substitutions: 3,
  updtr_fitness_gain: 20,
  updtr_fitness_after_injury: 80,
  AB_Goal: 50,
  AB_Assist: 35,
  AB_Victory_Random: 60,
  AB_Clean_Sheet: 50,
  AB_Ktk: 18,
  AB_Kps: 12,
  AB_Sht_On: 2,
  AB_Sht_Off: 0,
  AB_Sav: 12,
  AB_Defeat_Random: -60,
  AB_Concede: -8,
  AB_Yellow: -8,
  AB_Red: -20,
};
