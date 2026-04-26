// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Match simulation engine ported from ESMS (Electronic Soccer Management Simulator)
// by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/esms.cpp, src/penalty.cpp

import type {
  SimTeam,
  SimPlayer,
  SimResult,
  MatchEvent,
  Player,
  LineupPlayer,
  ConditionalInstruction,
  LeagueConfig,
} from './types';
import { MersenneTwister } from './random';
import { getMult, fullposToPosition, fullposToSide, ensureTacticsLoaded } from './tactics';
import { randComment, setCommentaryRng } from './commentary';
import { testConditions } from './conditionals';

const CHANCE_BASE_PROB = 0.16;
const CHANCE_RATIO_WEIGHT = 1.0;
const TACKLE_BASE = 0.08;
const TACKLE_RATIO_WEIGHT = 0.14;
const ON_TARGET_BASE = 0.33;
const ON_TARGET_SKILL_WEIGHT = 0.10;
const ON_TARGET_SKILL_SCALE = 30;
const SAVE_BASE = 0.55;
const SAVE_SKILL_WEIGHT = 0.30;
const GOAL_CANCELLED_RATE = 0.05;
const ASSIST_RATE = 0.60;
const FOUL_BASE_PROB = 0.10;
const FOUL_AGGR_FACTOR = 0.0001;
const YELLOW_CARD_RATE = 0.17;
const STRAIGHT_RED_RATE = 0.004;
const PENALTY_FROM_FOUL_RATE = 0.008;
const CORNER_FROM_SAVE_RATE = 0.35;
const CORNER_FROM_BLOCK_RATE = 0.20;
const CORNER_BASE_PROB = 0.04;
const OFFSIDE_IN_CHANCE_RATE = 0.08;
const OFFSIDE_BASE_PROB = 0.02;
const INJURY_BASE_PROB = 0.0012;
const INJURY_AGGR_FACTOR = 0.000001;
const MIN_FATIGUE = 0.10;
const FATIGUE_NOISE = 0.006;

function makeSimPlayer(p: Player, position: string): SimPlayer {
  const side = fullposToSide(position);
  const likes_left = p.pref_side.includes('L') || p.pref_side === 'R';
  const likes_right = p.pref_side.includes('R') || p.pref_side === 'L';
  const likes_center = p.pref_side.includes('C') || p.pref_side === 'L' || p.pref_side === 'R';
  return {
    name: p.name,
    pos: position,
    side,
    pref_side: p.pref_side,
    st: p.st,
    tk: p.tk,
    ps: p.ps,
    sh: p.sh,
    ag: p.ag,
    stamina: p.sm,
    injury: p.injury,
    suspension: p.suspension,
    likes_left,
    likes_right,
    likes_center,
    tk_contrib: 0,
    ps_contrib: 0,
    sh_contrib: 0,
    nominal_fatigue_per_minute: 0,
    fatigue: 1 - p.fitness / 100,
    injured: 0,
    active: 1,
    minutes: 0,
    shots: 0,
    goals: 0,
    saves: 0,
    tackles: 0,
    keypasses: 0,
    assists: 0,
    fouls: 0,
    yellowcards: 0,
    redcards: 0,
    shots_on: 0,
    shots_off: 0,
    conceded: 0,
    dp: 0,
    st_ab: 0,
    tk_ab: 0,
    ps_ab: 0,
    sh_ab: 0,
    player_id: p.id,
    corners: 0,
    offsides: 0,
  };
}

function calcPlayerContributions(
  player: SimPlayer,
  tactic: string,
  oppTactic: string
): void {
  const pos = fullposToPosition(player.pos);
  if (pos === 'GK') {
    player.tk_contrib = 0;
    player.ps_contrib = 0;
    player.sh_contrib = 0;
    return;
  }
  const fatigueFactor = 1 - player.fatigue;
  player.tk_contrib = player.tk * getMult(tactic, oppTactic, pos, 'TK') * fatigueFactor;
  player.ps_contrib = player.ps * getMult(tactic, oppTactic, pos, 'PS') * fatigueFactor;
  player.sh_contrib = player.sh * getMult(tactic, oppTactic, pos, 'SH') * fatigueFactor;
  adjustContribWithSideBalance(player);
}

function adjustContribWithSideBalance(player: SimPlayer): void {
  const pos = fullposToPosition(player.pos);
  if (pos === 'GK') return;
  const side = player.side;
  if (side === 'C') {
    if (!player.likes_center) {
      player.tk_contrib *= 0.85;
      player.ps_contrib *= 0.85;
      player.sh_contrib *= 0.85;
    }
  } else if (side === 'L') {
    if (!player.likes_left) {
      player.tk_contrib *= 0.75;
      player.ps_contrib *= 0.75;
      player.sh_contrib *= 0.75;
    }
  } else if (side === 'R') {
    if (!player.likes_right) {
      player.tk_contrib *= 0.75;
      player.ps_contrib *= 0.75;
      player.sh_contrib *= 0.75;
    }
  }
}

function calcNominalFatigue(player: SimPlayer): void {
  player.nominal_fatigue_per_minute =
    0.0031 - ((player.stamina - 50) / 50) * 0.0022;
  if (player.nominal_fatigue_per_minute < 0) player.nominal_fatigue_per_minute = 0;
}

function initTeamData(
  lineup: LineupPlayer[],
  roster: Player[],
  tactic: string,
  teamName: string,
  penaltyTakerName: string | null,
  subs: number
): SimTeam {
  const players: SimPlayer[] = [];
  let penaltyTakerIndex = -1;

  for (const lp of lineup) {
    const rp = roster.find((r) => r.id === lp.player_id);
    if (!rp) continue;
    const sp = makeSimPlayer(rp, lp.position);
    sp.active = lp.is_sub ? 2 : 1;
    calcPlayerContributions(sp, tactic, tactic);
    calcNominalFatigue(sp);
    players.push(sp);
  }

  if (penaltyTakerName) {
    penaltyTakerIndex = players.findIndex((p) => p.name === penaltyTakerName);
  }
  if (penaltyTakerIndex === -1) {
    const firstFw = players.findIndex((p) => p.active === 1 && fullposToPosition(p.pos) === 'FW');
    penaltyTakerIndex = firstFw !== -1 ? firstFw : 0;
  }

  const aggression = players
    .filter((p) => p.active === 1)
    .reduce((sum, p) => sum + p.ag, 0);

  return {
    players,
    score: 0,
    tactic,
    aggression,
    cond_substitutions_left: subs,
    name: teamName,
    penalty_taker_index: penaltyTakerIndex,
    possession_minutes: 0,
  };
}

function recalcTeamData(team: SimTeam, oppTactic: string): void {
  let aggr = 0;
  for (const p of team.players) {
    if (p.active !== 1) continue;
    calcPlayerContributions(p, team.tactic, oppTactic);
    aggr += p.ag;
  }
  team.aggression = aggr;
}

function getTeamAttack(team: SimTeam): number {
  let total = 0;
  for (const p of team.players) {
    if (p.active !== 1 || fullposToPosition(p.pos) === 'GK') continue;
    total += p.sh_contrib * 0.6 + p.ps_contrib * 0.4;
  }
  return total;
}

function getTeamDefence(team: SimTeam): number {
  let total = 0;
  for (const p of team.players) {
    if (p.active !== 1 || fullposToPosition(p.pos) === 'GK') continue;
    total += p.tk_contrib;
  }
  return total;
}

function getTeamMidfield(team: SimTeam): number {
  let total = 0;
  for (const p of team.players) {
    if (p.active !== 1) continue;
    total += p.ps_contrib;
  }
  return total;
}

function findActiveGK(team: SimTeam): SimPlayer | null {
  return team.players.find((p) => p.active === 1 && fullposToPosition(p.pos) === 'GK') ?? null;
}

function calcChanceProb(team: SimTeam, opp: SimTeam, homeBonus: number): number {
  const attack = getTeamAttack(team);
  const defence = getTeamDefence(opp);
  const ratio = attack / (attack + defence + 0.01);
  return Math.max(0, CHANCE_BASE_PROB * (0.5 + CHANCE_RATIO_WEIGHT * ratio) + homeBonus);
}

function calcTackleRate(team: SimTeam, opp: SimTeam): number {
  const oppTk = getTeamDefence(opp);
  const teamSh = getTeamAttack(team);
  const ratio = oppTk / (oppTk + teamSh + 0.01);
  return TACKLE_BASE + TACKLE_RATIO_WEIGHT * ratio;
}

function calcOnTargetProb(shooter: SimPlayer): number {
  const skill = shooter.sh * (1 - shooter.fatigue);
  return ON_TARGET_BASE + ON_TARGET_SKILL_WEIGHT * skill / (skill + ON_TARGET_SKILL_SCALE);
}

function calcSaveProb(shooter: SimPlayer, gk: SimPlayer): number {
  const shooterSkill = shooter.sh * (1 - shooter.fatigue);
  const gkSkill = gk.st * (1 - gk.fatigue);
  return SAVE_BASE + SAVE_SKILL_WEIGHT * gkSkill / (gkSkill + shooterSkill + 0.01);
}

function weightedRandom(indices: number[], weights: number[], rng: MersenneTwister): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return indices[rng.randomInt(indices.length)];
  let r = rng.randomp() * total;
  for (let i = 0; i < indices.length; i++) {
    r -= weights[i];
    if (r <= 0) return indices[i];
  }
  return indices[indices.length - 1];
}

function pickBySkill(team: SimTeam, skill: 'TK' | 'PS' | 'SH', rng: MersenneTwister): number {
  const weights: number[] = [];
  const active: number[] = [];
  for (let i = 0; i < team.players.length; i++) {
    const p = team.players[i];
    if (p.active !== 1) continue;
    if (fullposToPosition(p.pos) === 'GK') continue;
    let w: number;
    if (skill === 'SH') w = p.sh_contrib;
    else if (skill === 'TK') w = p.tk_contrib;
    else w = p.ps_contrib;
    weights.push(w);
    active.push(i);
  }
  if (active.length === 0) return -1;
  return weightedRandom(active, weights, rng);
}

function pickAssister(team: SimTeam, shooterIdx: number, rng: MersenneTwister): number {
  const weights: number[] = [];
  const active: number[] = [];
  for (let i = 0; i < team.players.length; i++) {
    const p = team.players[i];
    if (p.active !== 1) continue;
    if (i === shooterIdx) continue;
    if (fullposToPosition(p.pos) === 'GK') continue;
    weights.push(p.ps_contrib);
    active.push(i);
  }
  if (active.length === 0) return -1;
  return weightedRandom(active, weights, rng);
}

function resolveChance(
  team: SimTeam,
  opp: SimTeam,
  minute: number,
  events: MatchEvent[],
  isHome: boolean,
  rng: MersenneTwister
): void {
  const shooterIdx = pickBySkill(team, 'SH', rng);
  if (shooterIdx === -1) return;
  const shooter = team.players[shooterIdx];

  let isAssisted = rng.randomp() < ASSIST_RATE;
  let assisterIdx = -1;
  let assister: SimPlayer | null = null;

  if (isAssisted) {
    assisterIdx = pickAssister(team, shooterIdx, rng);
    if (assisterIdx !== -1 && assisterIdx !== shooterIdx) {
      assister = team.players[assisterIdx];
      events.push({
        minute,
        type: 'ASSISTEDCHANCE',
        team: isHome ? 'home' : 'away',
        player: shooter.name,
        secondary_player: assister.name,
        commentary: randComment('ASSISTEDCHANCE', shooter.name, assister.name),
      });
    } else {
      isAssisted = false;
    }
  }

  if (!isAssisted) {
    events.push({
      minute,
      type: 'CHANCE',
      team: isHome ? 'home' : 'away',
      player: shooter.name,
      commentary: randComment('CHANCE', shooter.name),
    });
  }

  if (rng.randomp() < OFFSIDE_IN_CHANCE_RATE) {
    shooter.offsides++;
    events.push({
      minute,
      type: 'OFFSIDE',
      team: isHome ? 'home' : 'away',
      player: shooter.name,
      commentary: randComment('OFFSIDE', shooter.name),
    });
    return;
  }

  const tackleRate = calcTackleRate(team, opp);
  if (rng.randomp() < tackleRate) {
    const tacklerIdx = pickBySkill(opp, 'TK', rng);
    if (tacklerIdx !== -1) {
      const tackler = opp.players[tacklerIdx];
      tackler.tackles++;
      tackler.tk_ab += 5;
      shooter.tk_ab -= 3;
      events.push({
        minute,
        type: 'TACKLE',
        team: isHome ? 'home' : 'away',
        player: shooter.name,
        secondary_player: tackler.name,
        commentary: randComment('TACKLE', shooter.name, tackler.name),
      });
      if (rng.randomp() < CORNER_FROM_BLOCK_RATE) {
        awardCorner(team, minute, events, isHome, rng);
      }
      return;
    }
  }

  shooter.shots++;

  if (rng.randomp() >= calcOnTargetProb(shooter)) {
    shooter.shots_off++;
    events.push({
      minute,
      type: 'OFFTARGET',
      team: isHome ? 'home' : 'away',
      player: shooter.name,
      commentary: randComment('OFFTARGET', shooter.name),
    });
    return;
  }

  shooter.shots_on++;

  const oppGk = findActiveGK(opp);

  if (oppGk && rng.randomp() < calcSaveProb(shooter, oppGk)) {
    oppGk.saves++;
    oppGk.st_ab += 5;
    events.push({
      minute,
      type: 'SAVE',
      team: isHome ? 'home' : 'away',
      player: shooter.name,
      secondary_player: oppGk.name,
      commentary: randComment('SAVE', shooter.name, oppGk.name),
    });
    if (rng.randomp() < CORNER_FROM_SAVE_RATE) {
      awardCorner(team, minute, events, isHome, rng);
    }
    return;
  }

  if (rng.randomp() < GOAL_CANCELLED_RATE) {
    events.push({
      minute,
      type: 'GOALCANCELLED',
      team: isHome ? 'home' : 'away',
      player: shooter.name,
      commentary: randComment('GOALCANCELLED', shooter.name),
    });
    return;
  }

  shooter.goals++;
  team.score++;
  if (assister) {
    assister.keypasses++;
    assister.assists++;
    assister.ps_ab += 15;
  }
  if (oppGk) oppGk.conceded++;

  events.push({
    minute,
    type: 'GOAL',
    team: isHome ? 'home' : 'away',
    player: shooter.name,
    secondary_player: assister?.name,
    commentary: randComment('GOAL', shooter.name),
  });
}

function awardCorner(
  team: SimTeam,
  minute: number,
  events: MatchEvent[],
  isHome: boolean,
  rng: MersenneTwister
): void {
  const takerIdx = pickBySkill(team, 'PS', rng);
  if (takerIdx === -1) return;
  const taker = team.players[takerIdx];
  taker.corners++;
  events.push({
    minute,
    type: 'CORNER',
    team: isHome ? 'home' : 'away',
    player: taker.name,
    commentary: randComment('CORNER', taker.name),
  });
}

function checkOffside(
  team: SimTeam,
  minute: number,
  events: MatchEvent[],
  isHome: boolean,
  rng: MersenneTwister
): void {
  if (rng.randomp() >= OFFSIDE_BASE_PROB) return;
  const idx = pickBySkill(team, 'SH', rng);
  if (idx === -1) return;
  const player = team.players[idx];
  player.offsides++;
  events.push({
    minute,
    type: 'OFFSIDE',
    team: isHome ? 'home' : 'away',
    player: player.name,
    commentary: randComment('OFFSIDE', player.name),
  });
}

function ifCorner(
  team: SimTeam,
  minute: number,
  events: MatchEvent[],
  isHome: boolean,
  rng: MersenneTwister
): void {
  if (rng.randomp() >= CORNER_BASE_PROB) return;
  awardCorner(team, minute, events, isHome, rng);
}

function ifFoul(
  team: SimTeam,
  opp: SimTeam,
  minute: number,
  events: MatchEvent[],
  config: { dp_for_yellow: number; dp_for_red: number; max_injury_length: number },
  isHome: boolean,
  yellowCarded: boolean[],
  _redCarded: boolean[],
  _injuredInd: boolean[],
  rng: MersenneTwister
): void {
  const foulProb = FOUL_BASE_PROB + team.aggression * FOUL_AGGR_FACTOR;
  if (rng.randomp() >= foulProb) return;

  const foulerIdx = pickBySkill(team, 'TK', rng);
  if (foulerIdx === -1) return;
  const fouler = team.players[foulerIdx];
  fouler.fouls++;

  events.push({
    minute,
    type: 'FOUL',
    team: isHome ? 'home' : 'away',
    player: fouler.name,
    commentary: randComment('FOUL', fouler.name),
  });

  const cardRoll = rng.randomp();
  if (cardRoll < YELLOW_CARD_RATE) {
    fouler.dp += config.dp_for_yellow;
    fouler.yellowcards++;
    const activeIdx = team.players
      .filter((p) => p.active === 1)
      .indexOf(fouler);
    if (activeIdx >= 0 && activeIdx < 11) yellowCarded[activeIdx] = true;

    if (fouler.yellowcards >= 2) {
      fouler.redcards++;
      fouler.active = 0;
      events.push({
        minute,
        type: 'SECONDYELLOWCARD',
        team: isHome ? 'home' : 'away',
        player: fouler.name,
        commentary: randComment('SECONDYELLOWCARD', fouler.name),
      });
    } else {
      events.push({
        minute,
        type: 'YELLOWCARD',
        team: isHome ? 'home' : 'away',
        player: fouler.name,
        commentary: randComment('YELLOWCARD', fouler.name),
      });
    }
  } else if (cardRoll < YELLOW_CARD_RATE + STRAIGHT_RED_RATE) {
    fouler.dp += config.dp_for_red;
    fouler.redcards++;
    fouler.active = 0;
    events.push({
      minute,
      type: 'REDCARD',
      team: isHome ? 'home' : 'away',
      player: fouler.name,
      commentary: randComment('REDCARD', fouler.name),
    });
  }

  if (rng.randomp() < PENALTY_FROM_FOUL_RATE) {
    const oppGkIdx = opp.players.findIndex(
      (p) => p.active === 1 && fullposToPosition(p.pos) === 'GK'
    );
    if (oppGkIdx !== -1 || rng.randomp() < 0.3) {
      events.push({
        minute,
        type: 'PENALTY',
        team: isHome ? 'home' : 'away',
        player: '',
        commentary: randComment('PENALTY'),
      });
      takePenalty(team, opp, minute, events, isHome, rng);
    }
  }
}

function takePenalty(
  team: SimTeam,
  opp: SimTeam,
  minute: number,
  events: MatchEvent[],
  isHome: boolean,
  rng: MersenneTwister
): void {
  let takerIdx = team.penalty_taker_index;
  if (takerIdx === -1 || team.players[takerIdx].active !== 1) {
    takerIdx = pickBySkill(team, 'SH', rng);
  }
  if (takerIdx === -1) return;

  const taker = team.players[takerIdx];
  const gk = findActiveGK(opp);

  const gkSt = gk ? gk.st * (1 - gk.fatigue) : 0;
  const takerSh = taker.sh * (1 - taker.fatigue);
  const goalProb = (8000 + takerSh * 100 - gkSt * 100) / 10000;
  taker.shots++;
  taker.shots_on++;

  if (rng.randomp() < goalProb) {
    taker.goals++;
    team.score++;
    events.push({
      minute,
      type: 'GOAL',
      team: isHome ? 'home' : 'away',
      player: taker.name,
      detail: 'pen',
      commentary: randComment('GOAL', taker.name),
    });
  } else {
    if (gk) {
      gk.saves++;
    }
    events.push({
      minute,
      type: 'SAVE',
      team: isHome ? 'home' : 'away',
      player: taker.name,
      secondary_player: gk?.name ?? 'GK',
      commentary: randComment('SAVE', taker.name, gk?.name ?? 'GK'),
    });
  }
}

function randomInjury(
  team: SimTeam,
  opp: SimTeam,
  minute: number,
  events: MatchEvent[],
  maxInjuryLength: number,
  isHome: boolean,
  injuredInd: boolean[],
  rng: MersenneTwister
): void {
  const injProb = INJURY_BASE_PROB + opp.aggression * INJURY_AGGR_FACTOR;
  if (rng.randomp() >= injProb) return;

  const activePlayers = team.players
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p.active === 1 && fullposToPosition(x.p.pos) !== 'GK');
  if (activePlayers.length === 0) return;

  const victim = activePlayers[rng.randomInt(activePlayers.length)];
  const player = victim.p;
  const injLength = Math.max(1, rng.randomInt(maxInjuryLength) + 1);
  player.injured = injLength;
  player.injury = injLength;
  player.active = 0;

  const activeIdx = team.players
    .filter((p) => p.active === 1)
    .indexOf(player);
  if (activeIdx >= 0 && activeIdx < 11) injuredInd[activeIdx] = true;

  events.push({
    minute,
    type: 'INJURY',
    team: isHome ? 'home' : 'away',
    player: player.name,
    detail: `${injLength} weeks`,
    commentary: randComment('INJURY', player.name),
  });

  autoSubstitute(team, minute, events, isHome);
}

function autoSubstitute(
  team: SimTeam,
  minute: number,
  events: MatchEvent[],
  isHome: boolean
): void {
  const bench = team.players.filter((p) => p.active === 2);
  if (bench.length === 0) {
    events.push({
      minute,
      type: 'NOSUBSLEFT',
      team: isHome ? 'home' : 'away',
      player: '',
      commentary: randComment('NOSUBSLEFT'),
    });
    return;
  }

  const injuredPlayer = team.players.find((p) => p.injured > 0 && p.active === 0);
  if (!injuredPlayer) return;

  const injPos = fullposToPosition(injuredPlayer.pos);
  let bestSub = bench[0];
  let bestScore = -1;

  for (const sub of bench) {
    let score = 0;
    const subPos = fullposToPosition(sub.pos);
    if (subPos === injPos) score += 100;
    if (injPos === 'GK' && subPos === 'GK') score += 200;
    score += sub.st + sub.tk + sub.ps + sub.sh;
    if (score > bestScore) {
      bestScore = score;
      bestSub = sub;
    }
  }

  bestSub.active = 1;
  bestSub.pos = injuredPlayer.pos;
  bestSub.side = injuredPlayer.side;
  calcPlayerContributions(bestSub, team.tactic, team.tactic);
  calcNominalFatigue(bestSub);

  events.push({
    minute,
    type: 'SUB',
    team: isHome ? 'home' : 'away',
    player: bestSub.name,
    secondary_player: injuredPlayer.name,
    commentary: randComment('SUB', bestSub.name, injuredPlayer.name),
  });
}

function substitutePlayer(
  team: SimTeam,
  outIdx: number,
  inIdx: number,
  minute: number,
  events: MatchEvent[],
  isHome: boolean
): boolean {
  if (team.cond_substitutions_left <= 0) return false;
  const outPlayer = team.players[outIdx];
  const inPlayer = team.players[inIdx];
  if (outPlayer.active !== 1 || inPlayer.active !== 2) return false;

  inPlayer.active = 1;
  inPlayer.pos = outPlayer.pos;
  inPlayer.side = outPlayer.side;
  outPlayer.active = 0;
  calcPlayerContributions(inPlayer, team.tactic, team.tactic);
  calcNominalFatigue(inPlayer);
  team.cond_substitutions_left--;

  events.push({
    minute,
    type: 'SUB',
    team: isHome ? 'home' : 'away',
    player: inPlayer.name,
    secondary_player: outPlayer.name,
    commentary: randComment('SUB', inPlayer.name, outPlayer.name),
  });
  return true;
}

function changeTactic(
  team: SimTeam,
  newTactic: string,
  oppTactic: string,
  minute: number,
  events: MatchEvent[],
  isHome: boolean
): void {
  team.tactic = newTactic;
  for (const p of team.players) {
    if (p.active === 1) {
      calcPlayerContributions(p, newTactic, oppTactic);
    }
  }
  events.push({
    minute,
    type: 'CHANGETACTIC',
    team: isHome ? 'home' : 'away',
    player: '',
    detail: newTactic,
    commentary: randComment('CHANGETACTIC', newTactic),
  });
}

function changePosition(
  team: SimTeam,
  playerIdx: number,
  newPos: string,
  oppTactic: string,
  minute: number,
  events: MatchEvent[],
  isHome: boolean
): void {
  const player = team.players[playerIdx];
  player.pos = newPos;
  player.side = fullposToSide(newPos);
  calcPlayerContributions(player, team.tactic, oppTactic);
  events.push({
    minute,
    type: 'CHANGEPOSITION',
    team: isHome ? 'home' : 'away',
    player: player.name,
    detail: newPos,
    commentary: randComment('CHANGEPOSITION', player.name, newPos),
  });
}

function checkConditionals(
  conditionals: ConditionalInstruction[],
  team: SimTeam,
  oppTeam: SimTeam,
  minute: number,
  scoreDiff: number,
  events: MatchEvent[],
  isHome: boolean,
  yellowCarded: boolean[],
  redCarded: boolean[],
  injuredInd: boolean[]
): void {
  for (const cond of conditionals) {
    if (!testConditions(cond, minute, scoreDiff, team, yellowCarded, redCarded, injuredInd)) {
      continue;
    }

    const action = cond.action;
    if (action.type === 'TACTIC' && action.tactic) {
      changeTactic(team, action.tactic, oppTeam.tactic, minute, events, isHome);
    } else if (action.type === 'CHANGEPOS' && action.position) {
      const targetIdx = findPlayerByRef(team, action.player_ref);
      if (targetIdx !== -1) {
        changePosition(team, targetIdx, action.position, oppTeam.tactic, minute, events, isHome);
      }
    } else if (action.type === 'SUB' && action.position) {
      const outIdx = findWorstPlayerOnPos(team, action.position);
      const inIdx = findBenchPlayerByRef(team, action.player_ref);
      if (outIdx !== -1 && inIdx !== -1) {
        substitutePlayer(team, outIdx, inIdx, minute, events, isHome);
      }
    }
  }
}

function findPlayerByRef(team: SimTeam, ref: string | undefined): number {
  if (!ref) return -1;
  const idx = parseInt(ref, 10);
  if (!isNaN(idx) && idx >= 0 && idx < team.players.length) return idx;
  return team.players.findIndex((p) => p.name === ref);
}

function findBenchPlayerByRef(team: SimTeam, ref: string | undefined): number {
  if (!ref) return -1;
  return team.players.findIndex((p) => p.active === 2 && (p.name === ref));
}

function findWorstPlayerOnPos(team: SimTeam, pos: string): number {
  const basePos = fullposToPosition(pos);
  let worstIdx = -1;
  let worstScore = Infinity;
  for (let i = 0; i < team.players.length; i++) {
    const p = team.players[i];
    if (p.active !== 1) continue;
    if (fullposToPosition(p.pos) !== basePos) continue;
    let score: number;
    if (basePos === 'GK') score = p.st;
    else if (basePos === 'DF' || basePos === 'DM') score = p.tk;
    else if (basePos === 'MF' || basePos === 'AM') score = p.ps;
    else score = p.sh;
    if (score < worstScore) {
      worstScore = score;
      worstIdx = i;
    }
  }
  return worstIdx;
}

function howMuchInjTime(team1: SimTeam, team2: SimTeam, rng: MersenneTwister): number {
  let totalInjuries = 0;
  let totalFouls = 0;
  let totalSubs = 0;
  for (const p of team1.players) {
    if (p.injured > 0) totalInjuries++;
    if (p.active === 0 && p.injured === 0) totalSubs++;
    totalFouls += p.fouls;
  }
  for (const p of team2.players) {
    if (p.injured > 0) totalInjuries++;
    if (p.active === 0 && p.injured === 0) totalSubs++;
    totalFouls += p.fouls;
  }
  return Math.min(5, Math.ceil(totalInjuries * 0.5 + totalFouls * 0.02 + totalSubs * 0.5) + rng.randomInt(2));
}

function calcAbility(
  team: SimTeam,
  isWinner: boolean,
  isCleanSheet: boolean,
  goalsConceded: number,
  config: {
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
  },
  rng: MersenneTwister
): void {
  for (const p of team.players) {
    if (p.active === 0 && p.injured === 0) continue;

    if (fullposToPosition(p.pos) === 'GK') {
      p.st_ab += p.goals * config.AB_Goal;
    } else {
      p.sh_ab += p.goals * config.AB_Goal;
    }
    p.ps_ab += p.assists * config.AB_Assist;

    if (isWinner) {
      const randBonus = Math.floor(rng.randomp() * config.AB_Victory_Random);
      const idx1 = rng.randomInt(team.players.filter((pp) => pp.active === 1 || pp.injured > 0).length);
      const activePlayers = team.players.filter((pp) => pp.active === 1 || pp.injured > 0);
      if (activePlayers[idx1]) {
        activePlayers[idx1].st_ab += randBonus;
        activePlayers[idx1].tk_ab += randBonus;
        activePlayers[idx1].ps_ab += randBonus;
        activePlayers[idx1].sh_ab += randBonus;
      }
      const idx2 = rng.randomInt(activePlayers.length);
      if (activePlayers[idx2]) {
        activePlayers[idx2].st_ab += randBonus;
        activePlayers[idx2].tk_ab += randBonus;
        activePlayers[idx2].ps_ab += randBonus;
        activePlayers[idx2].sh_ab += randBonus;
      }
    } else {
      const randPen = Math.floor(rng.randomp() * Math.abs(config.AB_Defeat_Random));
      const activePlayers = team.players.filter((pp) => pp.active === 1 || pp.injured > 0);
      const idx1 = rng.randomInt(activePlayers.length);
      if (activePlayers[idx1]) {
        activePlayers[idx1].st_ab -= randPen;
        activePlayers[idx1].tk_ab -= randPen;
        activePlayers[idx1].ps_ab -= randPen;
        activePlayers[idx1].sh_ab -= randPen;
      }
      const idx2 = rng.randomInt(activePlayers.length);
      if (activePlayers[idx2]) {
        activePlayers[idx2].st_ab -= randPen;
        activePlayers[idx2].tk_ab -= randPen;
        activePlayers[idx2].ps_ab -= randPen;
        activePlayers[idx2].sh_ab -= randPen;
      }
    }

    if (isCleanSheet) {
      if (fullposToPosition(p.pos) === 'GK') {
        p.st_ab += config.AB_Clean_Sheet;
      }
      if (fullposToPosition(p.pos) === 'DF') {
        p.tk_ab += config.AB_Clean_Sheet / 2;
      }
    }

    p.tk_ab += p.tackles * config.AB_Ktk;
    p.ps_ab += p.keypasses * config.AB_Kps;
    p.sh_ab += p.shots_on * config.AB_Sht_On;
    p.sh_ab += p.shots_off * config.AB_Sht_Off;
    p.st_ab += p.saves * config.AB_Sav;

    if (fullposToPosition(p.pos) === 'GK') {
      p.st_ab -= goalsConceded * Math.abs(config.AB_Concede);
    }

    const isGk = fullposToPosition(p.pos) === 'GK';
    if (isGk) {
      p.st_ab += p.yellowcards * config.AB_Yellow;
    } else {
      p.tk_ab += p.yellowcards * config.AB_Yellow;
      p.sh_ab += p.yellowcards * config.AB_Yellow;
      p.ps_ab += p.yellowcards * config.AB_Yellow;
    }

    p.tk_ab += p.redcards * config.AB_Red;
    p.sh_ab += p.redcards * config.AB_Red;
    p.ps_ab += p.redcards * config.AB_Red;
  }
}

export interface PenaltyResult {
  home_score: number;
  away_score: number;
  rounds: Array<{
    home_scored: boolean;
    away_scored: boolean;
    home_taker: string;
    away_taker: string;
  }>;
}

function runPenaltyShootout(home: SimTeam, away: SimTeam, rng: MersenneTwister): PenaltyResult {
  const result: PenaltyResult = { home_score: 0, away_score: 0, rounds: [] };

  const homeTakers = assignPenaltyTakers(home);
  const awayTakers = assignPenaltyTakers(away);
  const homeGk = home.players.find((p) => p.active === 1 && fullposToPosition(p.pos) === 'GK');
  const awayGk = away.players.find((p) => p.active === 1 && fullposToPosition(p.pos) === 'GK');

  for (let i = 0; i < 5; i++) {
    const hTaker = homeTakers[i % homeTakers.length];
    const aTaker = awayTakers[i % awayTakers.length];
    const hGkSt = homeGk ? homeGk.st : 0;
    const aGkSt = awayGk ? awayGk.st : 0;

    const hScored = rng.randomp() < (8000 + hTaker.sh * 100 - aGkSt * 100) / 10000;
    const aScored = rng.randomp() < (8000 + aTaker.sh * 100 - hGkSt * 100) / 10000;

    if (hScored) result.home_score++;
    if (aScored) result.away_score++;

    result.rounds.push({
      home_scored: hScored,
      away_scored: aScored,
      home_taker: hTaker.name,
      away_taker: aTaker.name,
    });

    const hLeft = 5 - i - 1;
    const diff = result.home_score - result.away_score;
    if (Math.abs(diff) > hLeft) break;
  }

  if (result.home_score === result.away_score) {
    let suddenDeathIdx = 0;
    while (result.home_score === result.away_score) {
      const hTaker = homeTakers[(5 + suddenDeathIdx) % homeTakers.length];
      const aTaker = awayTakers[(5 + suddenDeathIdx) % awayTakers.length];
      const hGkSt = homeGk ? homeGk.st : 0;
      const aGkSt = awayGk ? awayGk.st : 0;

      const hScored = rng.randomp() < (8000 + hTaker.sh * 100 - aGkSt * 100) / 10000;
      const aScored = rng.randomp() < (8000 + aTaker.sh * 100 - hGkSt * 100) / 10000;

      if (hScored) result.home_score++;
      if (aScored) result.away_score++;

      result.rounds.push({
        home_scored: hScored,
        away_scored: aScored,
        home_taker: hTaker.name,
        away_taker: aTaker.name,
      });

      suddenDeathIdx++;
      if (suddenDeathIdx > 20) break;
    }
  }

  return result;
}

function assignPenaltyTakers(team: SimTeam): SimPlayer[] {
  const active = team.players
    .filter((p) => p.active === 1 && fullposToPosition(p.pos) !== 'GK')
    .sort((a, b) => b.sh - a.sh);
  if (active.length === 0) return team.players.filter((p) => p.active === 1);
  return active.slice(0, Math.min(5, active.length));
}

function updateFatigue(players: SimPlayer[], rng: MersenneTwister): void {
  for (const p of players) {
    if (p.active !== 1) continue;
    const fatigueInc =
      p.nominal_fatigue_per_minute +
      (rng.randomp() - 0.5) * FATIGUE_NOISE;
    p.fatigue = Math.min(1, Math.max(0, p.fatigue + fatigueInc));
    if (p.fatigue < MIN_FATIGUE) p.fatigue = MIN_FATIGUE;
    p.minutes++;
  }
}

function simMinute(
  home: SimTeam,
  away: SimTeam,
  min: number,
  events: MatchEvent[],
  config: LeagueConfig,
  homeConditionals: ConditionalInstruction[],
  awayConditionals: ConditionalInstruction[],
  homeYellow: boolean[],
  awayYellow: boolean[],
  homeRed: boolean[],
  awayRed: boolean[],
  homeInjured: boolean[],
  awayInjured: boolean[],
  rng: MersenneTwister
): void {
  homeYellow.fill(false);
  awayYellow.fill(false);
  homeRed.fill(false);
  awayRed.fill(false);
  homeInjured.fill(false);
  awayInjured.fill(false);

  updateFatigue(home.players, rng);
  updateFatigue(away.players, rng);

  recalcTeamData(home, away.tactic);
  recalcTeamData(away, home.tactic);

  const homePS = getTeamMidfield(home);
  const awayPS = getTeamMidfield(away);
  if (rng.randomp() < homePS / (homePS + awayPS + 0.01)) {
    home.possession_minutes++;
  } else {
    away.possession_minutes++;
  }

  const homeChanceProb = calcChanceProb(home, away, config.home_bonus / 10000);
  const awayChanceProb = calcChanceProb(away, home, 0);

  if (rng.randomp() < homeChanceProb) resolveChance(home, away, min, events, true, rng);
  if (rng.randomp() < awayChanceProb) resolveChance(away, home, min, events, false, rng);

  ifFoul(home, away, min, events, config, true, homeYellow, homeRed, awayInjured, rng);
  ifFoul(away, home, min, events, config, false, awayYellow, awayRed, homeInjured, rng);

  ifCorner(home, min, events, true, rng);
  ifCorner(away, min, events, false, rng);

  checkOffside(home, min, events, true, rng);
  checkOffside(away, min, events, false, rng);

  randomInjury(home, away, min, events, config.max_injury_length, true, homeInjured, rng);
  randomInjury(away, home, min, events, config.max_injury_length, false, awayInjured, rng);

  const scoreDiff = home.score - away.score;
  checkConditionals(homeConditionals, home, away, min, scoreDiff, events, true, homeYellow, homeRed, homeInjured);
  checkConditionals(awayConditionals, away, home, min, -scoreDiff, events, false, awayYellow, awayRed, awayInjured);
}

export function simulateMatch(
  homeRoster: Player[],
  awayRoster: Player[],
  homeLineup: LineupPlayer[],
  awayLineup: LineupPlayer[],
  homeTactic: string,
  awayTactic: string,
  homeName: string,
  awayName: string,
  homeConditionals: ConditionalInstruction[],
  awayConditionals: ConditionalInstruction[],
  homePenaltyTaker: string | null,
  awayPenaltyTaker: string | null,
  config: LeagueConfig,
  seed?: number
): SimResult {
  ensureTacticsLoaded();

  const rng = new MersenneTwister(seed !== undefined ? seed : Date.now() & 0xffffffff);
  setCommentaryRng(rng);

  const home = initTeamData(homeLineup, homeRoster, homeTactic, homeName, homePenaltyTaker, config.substitutions);
  const away = initTeamData(awayLineup, awayRoster, awayTactic, awayName, awayPenaltyTaker, config.substitutions);

  const events: MatchEvent[] = [];
  events.push({
    minute: 0,
    type: 'COMM_KICKOFF',
    team: 'home',
    player: '',
    commentary: randComment('COMM_KICKOFF'),
  });

  const homeYellow = new Array(11).fill(false) as boolean[];
  const awayYellow = new Array(11).fill(false) as boolean[];
  const homeRed = new Array(11).fill(false) as boolean[];
  const awayRed = new Array(11).fill(false) as boolean[];
  const homeInjured = new Array(11).fill(false) as boolean[];
  const awayInjured = new Array(11).fill(false) as boolean[];

  for (let half = 0; half < 2; half++) {
    const startMin = half * 45;
    const endMin = startMin + 45;

    for (let min = startMin + 1; min <= endMin; min++) {
      simMinute(home, away, min, events, config, homeConditionals, awayConditionals,
        homeYellow, awayYellow, homeRed, awayRed, homeInjured, awayInjured, rng);
    }

    if (half === 0) {
      events.push({
        minute: 45,
        type: 'COMM_HALFTIME',
        team: 'home',
        player: '',
        commentary: randComment('COMM_HALFTIME'),
      });
      events.push({
        minute: 45,
        type: 'COMM_SECONDHALF',
        team: 'home',
        player: '',
        commentary: randComment('COMM_SECONDHALF'),
      });
    }
  }

  const injTime = howMuchInjTime(home, away, rng);
  if (injTime > 0) {
    events.push({
      minute: 90,
      type: 'COMM_INJURYTIME',
      team: 'home',
      player: '',
      detail: `${injTime}`,
      commentary: randComment('COMM_INJURYTIME', injTime),
    });

    for (let min = 91; min <= 90 + injTime; min++) {
      simMinute(home, away, min, events, config, homeConditionals, awayConditionals,
        homeYellow, awayYellow, homeRed, awayRed, homeInjured, awayInjured, rng);
    }
  }

  events.push({
    minute: 90 + injTime,
    type: 'COMM_FULLTIME',
    team: 'home',
    player: '',
    commentary: randComment('COMM_FULLTIME'),
  });

  let penalties: PenaltyResult | undefined;
  if (home.score === away.score) {
    events.push({
      minute: 90 + injTime,
      type: 'COMM_PENALTIES',
      team: 'home',
      player: '',
      commentary: randComment('COMM_PENALTIES'),
    });
    penalties = runPenaltyShootout(home, away, rng);
  }

  const isHomeWinner = home.score > away.score;
  const isAwayWinner = away.score > home.score;
  const homeClean = away.score === 0;
  const awayClean = home.score === 0;

  calcAbility(home, isHomeWinner, homeClean, away.score, config, rng);
  calcAbility(away, isAwayWinner, awayClean, home.score, config, rng);

  const commentary = events.map((e) => `${e.minute}' ${e.commentary}`).join('\n');

  const totalPoss = home.possession_minutes + away.possession_minutes;
  const homePoss = totalPoss > 0 ? Math.round((home.possession_minutes / totalPoss) * 100) : 50;
  const awayPoss = totalPoss > 0 ? 100 - homePoss : 50;

  return {
    home_score: home.score,
    away_score: away.score,
    events,
    home_stats: home.players,
    away_stats: away.players,
    commentary,
    penalties,
    home_possession: homePoss,
    away_possession: awayPoss,
  };
}
