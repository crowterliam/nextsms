// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Round-robin fixture generation ported from ESMS
// (Electronic Soccer Management Simulator) by Eli Bendersky (https://github.com/eliben/esms)
//
// Original copyright (C) 1998-2005 Eli Bendersky, licensed under LGPL-3.0
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/fixtures.cpp

export interface FixtureRound {
  week: number;
  matches: Array<{ home: number; away: number }>;
}

export function generateFixtures(teamIds: number[]): FixtureRound[] {
  const n = teamIds.length;
  if (n < 2) return [];

  const teams = [...teamIds];
  const hasDummy = n % 2 !== 0;
  if (hasDummy) teams.push(-1);

  const totalTeams = teams.length;
  const roundsPerHalf = totalTeams - 1;
  const matchesPerRound = Math.floor(totalTeams / 2);

  const allRounds: FixtureRound[] = [];

  for (let round = 0; round < roundsPerHalf; round++) {
    const matches: Array<{ home: number; away: number }> = [];

    for (let match = 0; match < matchesPerRound; match++) {
      let h: number, a: number;
      if (match === 0) {
        h = teams[0];
        a = teams[(round % (totalTeams - 1)) + 1];
      } else {
        const homeIdx = ((round + match - 1) % (totalTeams - 1)) + 1;
        const awayIdx = ((round + (totalTeams - 1) - match - 1) % (totalTeams - 1)) + 1;
        h = teams[homeIdx];
        a = teams[awayIdx];
      }

      if (round % 2 === 1) {
        [h, a] = [a, h];
      }

      if (h !== -1 && a !== -1) {
        matches.push({ home: h, away: a });
      }
    }

    allRounds.push({ week: round + 1, matches });
  }

  const secondHalf: FixtureRound[] = allRounds.map((r, idx) => ({
    week: roundsPerHalf + idx + 1,
    matches: r.matches.map((m) => ({ home: m.away, away: m.home })),
  }));

  return [...allRounds, ...secondHalf];
}
