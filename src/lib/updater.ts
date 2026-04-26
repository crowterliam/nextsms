// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Post-match player updater ported from ESMS (Electronic Soccer Management Simulator)
// by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/updtr.cpp, src/updtr.h

import type { Player, SimPlayer } from './types';

export interface PlayerUpdate {
  player_id: number;
  games: number;
  saves: number;
  tackles: number;
  keypasses: number;
  shots: number;
  goals: number;
  assists: number;
  dp: number;
  injury: number;
  st_ab: number;
  tk_ab: number;
  ps_ab: number;
  sh_ab: number;
  st: number;
  tk: number;
  ps: number;
  sh: number;
}

export function handleSkillChange(player: PlayerUpdate): void {
  if (player.st_ab >= 1000) {
    player.st++;
    player.st_ab -= 700;
  }
  if (player.tk_ab >= 1000) {
    player.tk++;
    player.tk_ab -= 700;
  }
  if (player.ps_ab >= 1000) {
    player.ps++;
    player.ps_ab -= 700;
  }
  if (player.sh_ab >= 1000) {
    player.sh++;
    player.sh_ab -= 700;
  }

  if (player.st_ab < 0) {
    player.st = Math.max(1, player.st - 1);
    player.st_ab += 300;
  }
  if (player.tk_ab < 0) {
    player.tk = Math.max(1, player.tk - 1);
    player.tk_ab += 300;
  }
  if (player.ps_ab < 0) {
    player.ps = Math.max(1, player.ps - 1);
    player.ps_ab += 300;
  }
  if (player.sh_ab < 0) {
    player.sh = Math.max(1, player.sh - 1);
    player.sh_ab += 300;
  }
}

export function updatePlayerFromMatch(
  player: Player,
  matchStats: SimPlayer
): PlayerUpdate {
  const update: PlayerUpdate = {
    player_id: player.id,
    games: player.games + (matchStats.minutes > 0 ? 1 : 0),
    saves: player.saves + matchStats.saves,
    tackles: player.tackles + matchStats.tackles,
    keypasses: player.keypasses + matchStats.keypasses,
    shots: player.shots + matchStats.shots,
    goals: player.goals + matchStats.goals,
    assists: player.assists + matchStats.assists,
    dp: player.dp + matchStats.yellowcards * 4 + matchStats.redcards * 10,
    injury: matchStats.injured > 0 ? matchStats.injured : player.injury,
    st_ab: player.st_ab + (matchStats.st_ab - player.st_ab),
    tk_ab: player.tk_ab + (matchStats.tk_ab - player.tk_ab),
    ps_ab: player.ps_ab + (matchStats.ps_ab - player.ps_ab),
    sh_ab: player.sh_ab + (matchStats.sh_ab - player.sh_ab),
    st: player.st,
    tk: player.tk,
    ps: player.ps,
    sh: player.sh,
  };

  handleSkillChange(update);
  return update;
}

export function recoverFitness(players: Player[], gain: number, afterInjury: number): Player[] {
  return players.map((p) => {
    const update = { ...p };
    if (p.injury > 0) {
      update.fitness = afterInjury;
    } else {
      update.fitness = Math.min(100, p.fitness + gain);
    }
    return update;
  });
}

export function decreaseSuspensions(players: Player[]): Player[] {
  return players.map((p) => {
    const update = { ...p };
    if (p.suspension > 0) update.suspension--;
    return update;
  });
}

export function decreaseInjuries(players: Player[]): Player[] {
  return players.map((p) => {
    const update = { ...p };
    if (p.injury > 0) update.injury--;
    return update;
  });
}

export function increaseAges(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, age: p.age + 1 }));
}

export function resetStats(players: Player[], includeInjuries: boolean = false, includeSuspensions: boolean = false): Player[] {
  return players.map((p) => ({
    ...p,
    games: 0,
    saves: 0,
    tackles: 0,
    keypasses: 0,
    shots: 0,
    goals: 0,
    assists: 0,
    dp: 0,
    st_ab: 300,
    tk_ab: 300,
    ps_ab: 300,
    sh_ab: 300,
    fitness: 100,
    ...(includeInjuries ? { injury: 0 } : {}),
    ...(includeSuspensions ? { suspension: 0 } : {}),
  }));
}

export function checkSuspension(dp: number, margin: number): boolean {
  return dp >= margin;
}
