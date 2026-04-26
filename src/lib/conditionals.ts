// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Conditional instruction engine ported from ESMS (Electronic Soccer Management Simulator)
// by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/cond.cpp, src/cond.h, src/cond_action.cpp, src/cond_condition.cpp,
//   src/cond_utils.cpp, src/cond_utils.h

import type { ConditionalInstruction, SimTeam } from './types';
import {
  isLegalPosition,
  isLegalTactic,
  fullposToPosition,
} from './tactics';

export function parseConditionals(lines: string[]): ConditionalInstruction[] {
  const result: ConditionalInstruction[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseConditional(trimmed);
    if (parsed) result.push(parsed);
  }
  return result;
}

function parseConditional(line: string): ConditionalInstruction | null {
  const ifIdx = line.toUpperCase().indexOf(' IF ');
  if (ifIdx === -1) return null;

  const actionStr = line.substring(0, ifIdx).trim();
  const condStr = line.substring(ifIdx + 4).trim();

  const action = parseAction(actionStr);
  if (!action) return null;

  const condParts = condStr.split(/\s*,\s*/);
  const conditions = [];
  for (const cp of condParts) {
    const cond = parseCondition(cp.trim());
    if (cond) conditions.push(cond);
  }

  if (conditions.length === 0) return null;
  return { action, conditions };
}

function parseAction(str: string): ConditionalInstruction['action'] | null {
  const tokens = str.split(/\s+/);
  if (tokens.length < 2) return null;

  const type = tokens[0].toUpperCase() as 'TACTIC' | 'SUB' | 'CHANGEPOS';

  if (type === 'TACTIC') {
    const tactic = tokens[1].toUpperCase();
    if (!isLegalTactic(tactic)) return null;
    return { type, tactic };
  }

  if (type === 'CHANGEPOS') {
    if (tokens.length < 3) return null;
    if (!isLegalPosition(tokens[1])) return null;
    return { type, position: tokens[1].toUpperCase(), player_ref: tokens[2] };
  }

  if (type === 'SUB') {
    if (tokens.length < 4) return null;
    if (!isLegalPosition(tokens[1])) return null;
    return {
      type,
      position: tokens[1].toUpperCase(),
      player_ref: tokens[2],
      player_ref2: tokens[3],
    };
  }

  return null;
}

function parseCondition(str: string): ConditionalInstruction['conditions'][0] | null {
  const tokens = str.split(/\s+/);
  if (tokens.length < 3) return null;

  const type = tokens[0].toUpperCase() as 'MIN' | 'SCORE' | 'YELLOW' | 'RED' | 'INJ';
  const sign = tokens[1];

  if (type === 'MIN' || type === 'SCORE') {
    const value = parseInt(tokens[2], 10);
    if (isNaN(value)) return null;
    return { type, sign, value };
  }

  if (type === 'YELLOW' || type === 'RED' || type === 'INJ') {
    const pos = tokens[2].toUpperCase();
    if (isLegalPosition(pos)) {
      return { type, sign: '=', position: pos };
    }
    return { type, sign: '=', player_ref: tokens[2] };
  }

  return null;
}

export function evalSign(sign: string, left: number, right: number): boolean {
  switch (sign) {
    case '=': return left === right;
    case '>=': return left >= right;
    case '>': return left > right;
    case '<=': return left <= right;
    case '<': return left < right;
    default: return false;
  }
}

export function testConditions(
  cond: ConditionalInstruction,
  minute: number,
  scoreDiff: number,
  team: SimTeam,
  yellowCarded: boolean[],
  redCarded: boolean[],
  injuredInd: boolean[]
): boolean {
  for (const c of cond.conditions) {
    if (c.type === 'MIN') {
      if (c.value === undefined || !evalSign(c.sign, minute, c.value)) return false;
    } else if (c.type === 'SCORE') {
      if (c.value === undefined || !evalSign(c.sign, scoreDiff, c.value)) return false;
    } else if (c.type === 'YELLOW') {
      let found = false;
      for (let i = 0; i < 11; i++) {
        if (!yellowCarded[i]) continue;
        if (c.position && isLegalPosition(c.position)) {
          if (fullposToPosition(team.players[i].pos) === fullposToPosition(c.position)) {
            found = true;
            break;
          }
        } else if (c.player_ref) {
          if (team.players[i].name === c.player_ref) {
            found = true;
            break;
          }
        }
      }
      if (!found) return false;
    } else if (c.type === 'RED') {
      let found = false;
      for (let i = 0; i < 11; i++) {
        if (!redCarded[i]) continue;
        if (c.position && isLegalPosition(c.position)) {
          if (fullposToPosition(team.players[i].pos) === fullposToPosition(c.position)) {
            found = true;
            break;
          }
        } else if (c.player_ref) {
          if (team.players[i].name === c.player_ref) {
            found = true;
            break;
          }
        }
      }
      if (!found) return false;
    } else if (c.type === 'INJ') {
      let found = false;
      for (let i = 0; i < 11; i++) {
        if (!injuredInd[i]) continue;
        if (c.position && isLegalPosition(c.position)) {
          if (fullposToPosition(team.players[i].pos) === fullposToPosition(c.position)) {
            found = true;
            break;
          }
        } else if (c.player_ref) {
          if (team.players[i].name === c.player_ref) {
            found = true;
            break;
          }
        }
      }
      if (!found) return false;
    }
  }
  return true;
}
