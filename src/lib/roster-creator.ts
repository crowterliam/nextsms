// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Roster generation ported from ESMS (Electronic Soccer Management Simulator)
// by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/roster_creator.cpp, src/rosterplayer.cpp, src/rosterplayer.h

import { MersenneTwister } from './random';

const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const CONSONANTS = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'];
const NATIONALITIES = ['ARG', 'BRA', 'ENG', 'FRA', 'GER', 'ITA', 'ESP', 'NED', 'POR', 'URU', 'COL', 'CHI', 'MEX', 'USA', 'JPN', 'KOR', 'NGR', 'CMR', 'SEN', 'AUS'];
const FIRST_NAMES = ['Luis', 'Carlos', 'Juan', 'Pedro', 'Diego', 'Miguel', 'Rafael', 'Antonio', 'Manuel', 'Jorge', 'Pablo', 'Andres', 'Fernando', 'Roberto', 'Marco', 'Thiago', 'Lucas', 'Gabriel', 'Rafaela', 'Sergio', 'Alejandro', 'Eduardo', 'Ricardo', 'Alberto', 'Francisco', 'Daniel', 'Matias', 'Nicolas', 'Santiago', 'Sebastian', 'Gonzalo', 'Martin', 'Emiliano', 'Tomas', 'Cristian', 'Oscar', 'Adrian', 'Hugo', 'Ignacio', 'Felipe'];
const LAST_NAMES = ['Silva', 'Santos', 'Fernandez', 'Garcia', 'Lopez', 'Martinez', 'Rodriguez', 'Hernandez', 'Gonzalez', 'Perez', 'Torres', 'Ramirez', 'Costa', 'Oliveira', 'Almeida', 'Mendes', 'Carvalho', 'Ribeiro', 'Moreno', 'Ruiz', 'Diaz', 'Romero', 'Alvarez', 'Molina', 'Castro', 'Vargas', 'Herrera', 'Aguirre', 'Paredes', 'Espinoza', 'Navarro', 'Delgado', 'Cruz', 'Morales', 'Reyes', 'Gutierrez', 'Ortiz', 'Mendoza', 'Soto', 'Fuentes'];
const POSITIONS = [
  { key: 'gk', pos: 'GK', count: 3, primary: 'st', secondary: [] },
  { key: 'df', pos: 'DF', count: 8, primary: 'tk', secondary: ['ps'] },
  { key: 'dm', pos: 'DM', count: 3, primary: 'tk', secondary: ['ps'] },
  { key: 'mf', pos: 'MF', count: 8, primary: 'ps', secondary: ['sh'] },
  { key: 'am', pos: 'AM', count: 3, primary: 'ps', secondary: ['sh'] },
  { key: 'fw', pos: 'FW', count: 5, primary: 'sh', secondary: ['ps'] },
] as const;

interface RosterConfig {
  n_rosters: number;
  n_gk: number;
  n_df: number;
  n_dm: number;
  n_mf: number;
  n_am: number;
  n_fw: number;
  average_stamina: number;
  average_aggression: number;
  average_main_skill: number;
  average_mid_skill: number;
  average_secondary_skill: number;
  roster_name_prefix: string;
  generate_names: boolean;
}

const DEFAULT_ROSTER_CONFIG: RosterConfig = {
  n_rosters: 4,
  n_gk: 3,
  n_df: 8,
  n_dm: 3,
  n_mf: 8,
  n_am: 3,
  n_fw: 5,
  average_stamina: 50,
  average_aggression: 30,
  average_main_skill: 15,
  average_mid_skill: 12,
  average_secondary_skill: 9,
  roster_name_prefix: 'team',
  generate_names: true,
};

export interface GeneratedPlayer {
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
}

export interface GeneratedRoster {
  team_name: string;
  players: GeneratedPlayer[];
}

function generateName(rng: MersenneTwister): string {
  const first = FIRST_NAMES[rng.randomInt(FIRST_NAMES.length)];
  const last = LAST_NAMES[rng.randomInt(LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomPrefSide(rng: MersenneTwister): string {
  const r = rng.randomp();
  if (r < 0.15) return 'L';
  if (r < 0.30) return 'R';
  if (r < 0.80) return 'C';
  if (r < 0.90) return 'LC';
  if (r < 0.97) return 'RC';
  return 'RLC';
}

export function generateRoster(config: Partial<RosterConfig> = {}, seed?: number): GeneratedRoster {
  const cfg = { ...DEFAULT_ROSTER_CONFIG, ...config };
  const rng = new MersenneTwister(seed ?? Date.now() & 0xffffffff);
  const positionCounts: Record<string, number> = {
    GK: cfg.n_gk,
    DF: cfg.n_df,
    DM: cfg.n_dm,
    MF: cfg.n_mf,
    AM: cfg.n_am,
    FW: cfg.n_fw,
  };

  const players: GeneratedPlayer[] = [];
  const usedNames = new Set<string>();

  for (const posDef of POSITIONS) {
    const count = positionCounts[posDef.pos] || posDef.count;
    for (let i = 0; i < count; i++) {
      let name = '';
      if (cfg.generate_names) {
        do {
          name = generateName(rng);
        } while (usedNames.has(name));
        usedNames.add(name);
      } else {
        name = `Player_${posDef.pos}_${i + 1}`;
      }

      const mainSkill = Math.max(1, rng.randomGaussian(cfg.average_main_skill, 4));
      const midSkill = Math.max(1, rng.randomGaussian(cfg.average_mid_skill, 3));
      const secSkill = Math.max(1, rng.randomGaussian(cfg.average_secondary_skill, 2));

      const p: GeneratedPlayer = {
        name,
        age: rng.randomRange(18, 34),
        nationality: NATIONALITIES[rng.randomInt(NATIONALITIES.length)],
        pref_side: randomPrefSide(rng),
        st: 0,
        tk: 0,
        ps: 0,
        sh: 0,
        sm: Math.max(10, rng.randomGaussian(cfg.average_stamina, 10)),
        ag: Math.max(1, rng.randomGaussian(cfg.average_aggression, 8)),
      };

      if (posDef.primary === 'st') {
        p.st = mainSkill;
        p.tk = midSkill;
        p.ps = secSkill;
        p.sh = secSkill;
      } else if (posDef.primary === 'tk') {
        p.tk = mainSkill;
        p.ps = midSkill;
        p.st = secSkill;
        p.sh = secSkill;
      } else if (posDef.primary === 'ps') {
        p.ps = mainSkill;
        p.sh = midSkill;
        p.tk = secSkill;
        p.st = secSkill;
      } else {
        p.sh = mainSkill;
        p.ps = midSkill;
        p.tk = secSkill;
        p.st = secSkill;
      }

      players.push(p);
    }
  }

  players.sort((a, b) => {
    const posOrder: Record<string, number> = { GK: 0, DF: 1, DM: 2, MF: 3, AM: 4, FW: 5 };
    return 0;
  });

  return { team_name: '', players };
}

export function generateMultipleRosters(count: number, prefix: string, config: Partial<RosterConfig> = {}): GeneratedRoster[] {
  const rosters: GeneratedRoster[] = [];
  for (let i = 1; i <= count; i++) {
    const roster = generateRoster(config, Date.now() + i * 1000);
    roster.team_name = `${prefix}${i}`;
    rosters.push(roster);
  }
  return rosters;
}
