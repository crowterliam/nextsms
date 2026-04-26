// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Tactics multiplier matrix ported from ESMS (Electronic Soccer Management Simulator)
// by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/tactics.cpp, src/tactics.h

type TacticMatrix = Map<string, Map<string, Map<string, Map<string, number>>>>;

interface MultLine {
  type: 'MULT' | 'BONUS';
  tactic: string;
  opp_tactic: string;
  position: string;
  skill: string;
  value: number;
}

const POSITIONS = ['DF', 'DM', 'MF', 'AM', 'FW'];
const SKILLS = ['TK', 'PS', 'SH'];

let matrix: TacticMatrix = new Map();
const tacticNames: string[] = [];

export function getTacticNames(): string[] {
  return [...tacticNames];
}

export function loadTactics(text: string): void {
  matrix = new Map();
  const multLines: MultLine[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const tokens = line.split(/\s+/);
    if (tokens.length < 1) continue;

    if (tokens[0] === 'TACTIC') {
      if (tokens.length >= 3) {
        const name = tokens[1];
        if (!tacticNames.includes(name)) tacticNames.push(name);
      }
    } else if (tokens[0] === 'MULT') {
      if (tokens.length >= 5) {
        multLines.push({
          type: 'MULT',
          tactic: tokens[1],
          opp_tactic: 'ALL',
          position: tokens[2],
          skill: tokens[3],
          value: parseFloat(tokens[4]),
        });
      }
    } else if (tokens[0] === 'BONUS') {
      if (tokens.length >= 6) {
        multLines.push({
          type: 'BONUS',
          tactic: tokens[1],
          opp_tactic: tokens[2],
          position: tokens[3],
          skill: tokens[4],
          value: parseFloat(tokens[5]),
        });
      }
    }
  }

  multLines.sort((a, b) => {
    if (a.type === 'MULT' && b.type === 'BONUS') return -1;
    if (a.type === 'BONUS' && b.type === 'MULT') return 1;
    return 0;
  });

  for (const ml of multLines) {
    if (ml.type === 'MULT') {
      for (const opp of tacticNames) {
        setMult(ml.tactic, opp, ml.position, ml.skill, ml.value);
      }
    } else {
      const current = getMult(ml.tactic, ml.opp_tactic, ml.position, ml.skill);
      setMult(ml.tactic, ml.opp_tactic, ml.position, ml.skill, current + ml.value);
    }
  }
}

function setMult(tactic: string, oppTactic: string, position: string, skill: string, value: number): void {
  if (!matrix.has(tactic)) matrix.set(tactic, new Map());
  const t1 = matrix.get(tactic)!;
  if (!t1.has(oppTactic)) t1.set(oppTactic, new Map());
  const t2 = t1.get(oppTactic)!;
  if (!t2.has(position)) t2.set(position, new Map());
  t2.get(position)!.set(skill, value);
}

export function getMult(tactic: string, oppTactic: string, position: string, skill: string): number {
  return matrix.get(tactic)?.get(oppTactic)?.get(position)?.get(skill) ?? 1.0;
}

export function positionExists(pos: string): boolean {
  return POSITIONS.includes(pos);
}

export function skillExists(skill: string): boolean {
  return SKILLS.includes(skill);
}

export function isLegalPosition(pos: string): boolean {
  if (pos === 'GK') return true;
  if (pos.length !== 3) return false;
  const base = pos.substring(0, 2);
  const side = pos.substring(2, 3);
  return POSITIONS.includes(base) && ['L', 'R', 'C'].includes(side);
}

export function isLegalTactic(t: string): boolean {
  return tacticNames.includes(t);
}

export function fullposToPosition(fullpos: string): string {
  if (fullpos === 'GK') return 'GK';
  return fullpos.substring(0, 2);
}

export function fullposToSide(fullpos: string): string {
  if (fullpos === 'GK') return 'C';
  return fullpos.substring(2, 3);
}

export function posAndSide2Fullpos(pos: string, side: string): string {
  if (pos === 'GK') return 'GK';
  return pos + side;
}

export const TACTIC_NAMES_FULL: Record<string, string> = {
  N: 'Normal',
  D: 'Defensive',
  A: 'Attacking',
  C: 'Counter-Attack',
  L: 'Long Ball',
  P: 'Passing',
};

const DEFAULT_TACTICS = `# ESMS Tactics Data
# 6 tactics: Normal, Defensive, Attacking, Counter-Attack, Long Ball, Passing
# 5 positions: DF, DM, MF, AM, FW
# 3 skills: TK, PS, SH

TACTIC N Normal
TACTIC D Defensive
TACTIC A Attacking
TACTIC C Counter_Attack
TACTIC L Long_Ball
TACTIC P Passing

# Normal - balanced
MULT N DF TK 1.0
MULT N DF PS 0.4
MULT N DF SH 0.0
MULT N DM TK 0.9
MULT N DM PS 0.7
MULT N DM SH 0.2
MULT N MF TK 0.5
MULT N MF PS 1.0
MULT N MF SH 0.5
MULT N AM TK 0.2
MULT N AM PS 0.9
MULT N AM SH 0.8
MULT N FW TK 0.0
MULT N FW PS 0.4
MULT N FW SH 1.0

# Defensive - strong defence, weak attack
MULT D DF TK 1.25
MULT D DF PS 0.5
MULT D DF SH 0.0
MULT D DM TK 1.1
MULT D DM PS 0.8
MULT D DM SH 0.15
MULT D MF TK 0.7
MULT D MF PS 0.8
MULT D MF SH 0.3
MULT D AM TK 0.3
MULT D AM PS 0.7
MULT D AM SH 0.5
MULT D FW TK 0.0
MULT D FW PS 0.3
MULT D FW SH 0.75

# Attacking - strong attack, weak defence
MULT A DF TK 1.0
MULT A DF PS 0.3
MULT A DF SH 0.0
MULT A DM TK 0.75
MULT A DM PS 0.8
MULT A DM SH 0.3
MULT A MF TK 0.3
MULT A MF PS 1.0
MULT A MF SH 0.7
MULT A AM TK 0.0
MULT A AM PS 0.9
MULT A AM SH 1.13
MULT A FW TK 0.0
MULT A FW PS 0.5
MULT A FW SH 1.5

# Counter-Attack - strong defence + passing midfield
MULT C DF TK 1.1
MULT C DF PS 0.6
MULT C DF SH 0.0
MULT C DM TK 1.0
MULT C DM PS 0.9
MULT C DM SH 0.15
MULT C MF TK 0.5
MULT C MF PS 1.0
MULT C MF SH 0.7
MULT C AM TK 0.2
MULT C AM PS 0.9
MULT C AM SH 0.8
MULT C FW TK 0.0
MULT C FW PS 0.5
MULT C FW SH 1.2

# Long Ball - direct, strong DF, strong FW
MULT L DF TK 1.2
MULT L DF PS 0.4
MULT L DF SH 0.0
MULT L DM TK 1.0
MULT L DM PS 0.6
MULT L DM SH 0.2
MULT L MF TK 0.4
MULT L MF PS 0.7
MULT L MF SH 0.6
MULT L AM TK 0.0
MULT L AM PS 0.5
MULT L AM SH 0.9
MULT L FW TK 0.0
MULT L FW PS 0.3
MULT L FW SH 1.3

# Passing - midfield dominance
MULT P DF TK 1.0
MULT P DF PS 0.5
MULT P DF SH 0.0
MULT P DM TK 0.8
MULT P DM PS 1.0
MULT P DM SH 0.1
MULT P MF TK 0.4
MULT P MF PS 1.2
MULT P MF SH 0.4
MULT P AM TK 0.2
MULT P AM PS 1.1
MULT P AM SH 0.7
MULT P FW TK 0.0
MULT P FW PS 0.6
MULT P FW SH 0.9

# BONUS lines - tactic vs opponent tactic adjustments

# Defensive vs Long Ball
BONUS D L DF TK 0.25

# Counter vs Attacking
BONUS C A MF SH 0.5
BONUS C A DF PS 0.25
BONUS C A DF SH 0.25

# Counter vs Passing
BONUS C P MF SH 0.5
BONUS C P DF PS 0.25
BONUS C P DF SH 0.25

# Long Ball vs Counter
BONUS L C DF TK 0.25
BONUS L C DF PS 0.5

# Passing vs Long Ball
BONUS P L MF SH 0.5
BONUS P L MF TK 0.5
BONUS P L FW SH 0.25
`;

let initialized = false;

export function ensureTacticsLoaded(): void {
  if (!initialized) {
    loadTactics(DEFAULT_TACTICS);
    initialized = true;
  }
}
