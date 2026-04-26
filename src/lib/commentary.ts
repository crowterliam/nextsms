// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Commentary engine ported from ESMS (Electronic Soccer Management Simulator)
// by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/comment.cpp, src/comment.h

import { MersenneTwister } from './random';

type CommentMap = Map<string, string[]>;

let comments: CommentMap = new Map();
let rng: MersenneTwister | null = null;

export function loadCommentary(text: string): void {
  comments = new Map();
  let currentEvent: string | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const eventMatch = line.match(/^\[(\w+)\]\s*(.*)$/);
    if (eventMatch) {
      currentEvent = eventMatch[1];
      if (!comments.has(currentEvent)) comments.set(currentEvent, []);
      if (eventMatch[2].trim()) {
        comments.get(currentEvent)!.push(eventMatch[2].trim());
      }
      continue;
    }

    if (currentEvent && line.startsWith('{') && line.endsWith('}')) {
      const text = line.substring(1, line.length - 1).trim();
      comments.get(currentEvent)!.push(text);
    }
  }
}

export function setCommentaryRng(mt: MersenneTwister): void {
  rng = mt;
}

export function randComment(eventType: string, ...args: (string | number)[]): string {
  const options = comments.get(eventType);
  if (!options || options.length === 0) return `[${eventType}]`;

  const r = rng ?? new MersenneTwister(Date.now() & 0xffffffff);
  const idx = Math.floor(r.randomp() * options.length);
  let text = options[idx];

  for (let i = 0; i < args.length; i++) {
    text = text.replace(new RegExp(`%${i + 1}`, 'g'), String(args[i]));
  }

  text = text.replace(/\\n/g, '\n');
  return text;
}

const DEFAULT_COMMENTARY = `
[CHANCE]
{%1 runs with the ball...}
{A chance for %1...}
{%1 has the ball...}
{Quick feet by %1...}
{%1 on the run...}
{%1 takes on the defence...}
{%1 with a surging run forward...}
{%1 drives forward...}
{%1 looks dangerous...}
{%1 collects the ball in space...}
{%1 turns and runs at the defence...}
{%1 bursts through the midfield...}

[ASSISTEDCHANCE]
{%2 passes to %1...}
{%1 receives from %2...}
{Nice build up, %1 from %2...}
{%2 finds %1...}
{Great vision by %2, finds %1...}
{%2 with a clever ball to %1...}
{%2 slips it through to %1...}
{%1 latches onto %2's pass...}
{%2 plays a delightful ball to %1...}
{%2 cuts it back for %1...}

[TACKLE]
{But %2 makes a great tackle!}
{%2 with a crunching tackle!}
{Tackled by %2!}
{%2 dispossesses %1 cleanly!}
{Superb challenge by %2!}
{%2 slides in to win the ball!}
{%2 nicks it off %1's toes!}
{%2 with a perfectly timed challenge!}
{Brilliant defending by %2!}
{%2 robs %1 of the ball!}

[SHOT]
{%1 shoots!}
{%1 lets one fly!}
{%1 unleashes a shot!}
{What a hit by %1!}
{%1 winds up and shoots!}
{%1 tries his luck from distance!}
{%1 hits it first time!}
{%1 curls one goalward!}
{%1 smashes it!}
{%1 fires in a shot!}

[SAVE]
{But %2 makes a great save!}
{Saved by %2!}
{%2 dives to save!}
{What a save by %2!}
{%2 keeps it out!}
{%2 gets down to save!}
{%2 tips it over the bar!}
{%2 pushes it round the post!}
{Brilliant stop by %2!}
{%2 denies %1 with a fine save!}

[OFFTARGET]
{The shot goes wide!}
{Off target!}
{Just wide!}
{Over the bar!}
{The shot misses!}
{Wide of the post!}
{Just over the crossbar!}
{Dragged wide!}
{Blazes it over!}
{Fizzes past the post!}

[GOAL]
{GOAL! %1 scores!}
{GOOAALL! %1!}
{It's in the net! %1 scores!}
{%1 scores!!!}
{What a goal by %1!}
{GOAL! What a finish by %1!}
{%1 puts it in the back of the net!}
{Incredible! %1 scores!}
{%1 with a clinical finish!}
{The crowd erupts as %1 scores!}

[GOALCANCELLED]
{But the goal is disallowed!}
{No goal! The referee disallows it!}
{Wait - the flag is up! No goal!}

[INJURY]
{%1 is injured!}
{%1 goes down injured!}
{%1 can't continue!}
{Oh no, %1 is hurt!}
{Medical staff on for %1!}
{%1 is stretchered off!}
{%1 pulls up with an injury!}
{%1 goes down clutching his leg!}

[CHANGEPOSITION]
{%1 moves to %2.}
{Position change: %1 now at %2.}

[SUB]
{Substitution: %1 comes on for %2.}
{%1 replaces %2.}
{Change: %1 on for %2.}

[NOSUBSLEFT]
{No substitutes left!}

[CHANGETACTIC]
{Tactic changed to %1.}
{Switching to %1 tactic.}
{New tactic: %1.}

[FOUL]
{Foul by %1!}
{%1 brings down his opponent!}
{%1 with a late challenge!}
{Free kick given, foul by %1!}
{%1 clips his opponent!}
{%1 goes in hard!}

[PENALTY]
{PENALTY!}
{The referee points to the spot!}
{Penalty kick!}

[WARNED]
{%1 is warned by the referee.}
{The referee has a word with %1.}

[YELLOWCARD]
{Yellow card for %1!}
{%1 goes into the book!}
{Booked! %1 sees yellow!}

[SECONDYELLOWCARD]
{Second yellow for %1! He's off!}
{%1 receives a second yellow! RED CARD!}
{That's a second booking for %1!}

[REDCARD]
{RED CARD! %1 is sent off!}
{%1 sees red!}
{Off! %1 is given his marching orders!}

[COMM_KICKOFF]
{The referee blows the whistle for kick-off!}
{And we're under way!}

[COMM_HALFTIME]
{The referee blows for half time.}
{That's half time.}

[COMM_SECONDHALF]
{The second half is under way.}
{Back under way for the second half.}

[COMM_FULLTIME]
{The referee blows for full time.}
{That's it! Full time!}

[COMM_INJURYTIME]
{There will be %1 minutes of injury time.}

[COMM_MINUTE]
{%1'}

[COMM_PENALTIES]
{The match goes to penalties!}
{We go to a penalty shootout!}

[COMM_SCORE]
{%1}

[UPDTR_SKILL_INCREASE]
{%1 (%2) increased his %3 ability!}

[UPDTR_SKILL_DECREASE]
{%1 (%2) decreased his %3 ability...}

[UPDTR_SUSPENDED_1]
{%1 (%2) is suspended for 1 game.}

[UPDTR_SUSPENDED_N]
{%1 (%2) is suspended for %3 games.}

[UPDTR_INJURY_NONE]
{%1 (%2) shakes off a minor injury.}
{%1 (%2) is cleared by the doctor.}
{%1 (%2) passed the fitness test.}

[UPDTR_INJURY_1]
{%1 (%2) has a bruised knee.}
{%1 (%2) has a bruised hand.}
{%1 (%2) has a gashed hip.}

[UPDTR_INJURY_LIGHT]
{%1 (%2) has a groin strain, out for %3 weeks.}
{%1 (%2) has a sprained knee, out for %3 weeks.}
{%1 (%2) has a sprained ankle, out for %3 weeks.}
{%1 (%2) has a twisted ankle, out for %3 weeks.}
{%1 (%2) has knee inflammation, out for %3 weeks.}

[UPDTR_INJURY_HARD]
{%1 (%2) has a torn hamstring, out for %3 weeks!}
{%1 (%2) has a broken arm, out for %3 weeks!}
{%1 (%2) has ruptured ligaments, out for %3 weeks!}
{%1 (%2) has a torn achilles, out for %3 weeks!}
{%1 (%2) has a broken ankle, out for %3 weeks!}
{%1 (%2) has torn knee cartilage, out for %3 weeks!}

[UPDTR_END_SUSPENSION]
{%1 (%2) returns from suspension.}

[UPDTR_END_INJURY]
{%1 (%2) has recovered from injury.}

[PENALTYSHOOTOUT]
{Penalty Shootout!}

[WONPENALTYSHOOTOUT]
{%1 wins the penalty shootout!}

[CORNER]
{Corner kick for %1.}
{%1 to take the corner.}
{The ball goes behind for a corner.}
{%1 will swing this in.}
{Corner kick.}
{Flag kick for %1.}
{%1 trots over to take the corner.}
{The referee awards a corner.}
{%1 prepares to deliver the corner.}

[OFFSIDE]
{Offside against %1!}
{Flag up — offside!}
{%1 is caught offside.}
{Linesman flags, offside.}
{%1 strays offside.}
{Offside! %1 was too eager.}
{%1 times the run poorly — offside.}
`;

let commentaryInitialized = false;

export function ensureCommentaryLoaded(): void {
  if (!commentaryInitialized) {
    loadCommentary(DEFAULT_COMMENTARY);
    commentaryInitialized = true;
  }
}

ensureCommentaryLoaded();
