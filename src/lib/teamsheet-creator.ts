// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Teamsheet creation and formation parsing ported from ESMS
// (Electronic Soccer Management Simulator) by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/tsc.cpp, src/teamsheet_reader.cpp

import type { Player } from './types';

type SkillGetter = (p: Player) => number;

const stGetter: SkillGetter = (p) => Math.round((p.st * p.fitness) / 100);
const tkGetter: SkillGetter = (p) => Math.round((p.tk * p.fitness) / 100);
const psGetter: SkillGetter = (p) => Math.round((p.ps * p.fitness) / 100);
const shGetter: SkillGetter = (p) => Math.round((p.sh * p.fitness) / 100);

const POSITION_SKILL_MAP: Record<string, SkillGetter> = {
  GK: stGetter,
  DFC: tkGetter,
  DFL: tkGetter,
  DFR: tkGetter,
  DMC: tkGetter,
  DML: tkGetter,
  DMR: tkGetter,
  MFC: psGetter,
  MFL: psGetter,
  MFR: psGetter,
  AMC: psGetter,
  AML: psGetter,
  AMR: psGetter,
  FWC: shGetter,
  FWL: shGetter,
  FWR: shGetter,
};

const SUB_CYCLE = ['DFC', 'MFC', 'DFC', 'FWC', 'MFC'];

export interface Teamsheet {
  team_name: string;
  tactic: string;
  starting: Array<{ position: string; player: Player }>;
  subs: Array<{ position: string; player: Player }>;
  penalty_taker: Player | null;
}

export function parseFormation(formation: string): { positions: string[]; tactic: string } | null {
  if (formation.length < 3) return null;
  const tactic = formation.charAt(formation.length - 1).toUpperCase();
  const nums = formation.substring(0, formation.length - 1);

  const positions: string[] = ['GK'];
  const counts = nums.split('').map(Number);

  const posBases = ['DF', 'MF', 'FW'];
  for (let i = 0; i < counts.length && i < posBases.length; i++) {
    const count = counts[i];
    const base = posBases[i];
    if (count === 1) {
      positions.push(base + 'C');
    } else if (count === 2) {
      positions.push(base + 'L');
      positions.push(base + 'R');
    } else if (count >= 3) {
      positions.push(base + 'L');
      for (let j = 0; j < count - 2; j++) positions.push(base + 'C');
      positions.push(base + 'R');
    }
  }

  return { positions, tactic };
}

export function createTeamsheet(
  roster: Player[],
  formation: string,
  teamName: string,
  numSubs: number = 5
): Teamsheet {
  const parsed = parseFormation(formation);
  if (!parsed) {
    return createTeamsheet(roster, '442N', teamName, numSubs);
  }

  const { positions, tactic } = parsed;
  const available = roster.filter((p) => p.injury === 0 && p.suspension === 0);
  const used = new Set<number>();

  const starting: Array<{ position: string; player: Player }> = [];
  for (const pos of positions) {
    const best = chooseBestPlayer(available, POSITION_SKILL_MAP[pos] || psGetter, used);
    if (best) {
      starting.push({ position: pos, player: best.player });
      used.add(best.index);
    }
  }

  const subs: Array<{ position: string; player: Player }> = [];
  for (let i = 0; i < numSubs; i++) {
    const subPos = i === 0 ? 'GK' : SUB_CYCLE[(i - 1) % SUB_CYCLE.length];
    const best = chooseBestPlayer(available, POSITION_SKILL_MAP[subPos] || psGetter, used);
    if (best) {
      subs.push({ position: subPos, player: best.player });
      used.add(best.index);
    }
  }

  let penaltyTaker: Player | null = null;
  let bestSh = -1;
  for (const s of starting) {
    if (s.player.sh > bestSh) {
      bestSh = s.player.sh;
      penaltyTaker = s.player;
    }
  }

  return {
    team_name: teamName,
    tactic,
    starting,
    subs,
    penalty_taker: penaltyTaker,
  };
}

function chooseBestPlayer(
  available: Player[],
  getter: SkillGetter,
  used: Set<number>
): { player: Player; index: number } | null {
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < available.length; i++) {
    if (used.has(i)) continue;
    const score = getter(available[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? { player: available[bestIdx], index: bestIdx } : null;
}

export function teamsheetToLineup(sheet: Teamsheet): {
  lineup: Array<{ position: string; player_id: number; name: string; is_sub: boolean; sub_order: number }>;
  penalty_taker: string | null;
} {
  const lineup = [];
  let subOrder = 0;

  for (const s of sheet.starting) {
    lineup.push({
      position: s.position,
      player_id: s.player.id as number,
      name: s.player.name,
      is_sub: false,
      sub_order: 0,
    });
  }

  for (const s of sheet.subs) {
    lineup.push({
      position: s.position,
      player_id: s.player.id as number,
      name: s.player.name,
      is_sub: true,
      sub_order: ++subOrder,
    });
  }

  return {
    lineup,
    penalty_taker: sheet.penalty_taker?.name ?? null,
  };
}
