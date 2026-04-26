export interface KnockoutMatch {
  home_team_id: number;
  away_team_id: number;
  bracket_position: number;
  leg?: number;
}

export interface KnockoutRound {
  round_name: string;
  matches: KnockoutMatch[];
}

export interface GroupDrawResult {
  groups: Array<{
    name: string;
    team_ids: number[];
  }>;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function generateSeedPositions(size: number): number[] {
  if (size === 1) return [1];
  const half = generateSeedPositions(size / 2);
  const result: number[] = [];
  for (const s of half) {
    result.push(s);
    result.push(size + 1 - s);
  }
  return result;
}

export function generateRoundNames(totalRounds: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < totalRounds; i++) {
    const remaining = totalRounds - i;
    if (remaining === 1) names.push('Final');
    else if (remaining === 2) names.push('Semi-Final');
    else if (remaining === 3) names.push('Quarter-Final');
    else if (remaining === 4) names.push('Round of 16');
    else names.push(`Round ${i + 1}`);
  }
  return names;
}

export function generateKnockoutBracket(teamIds: number[]): KnockoutRound[] {
  const n = teamIds.length;
  if (n < 2) return [];

  const bracketSize = nextPowerOf2(n);

  const seedPositions = generateSeedPositions(bracketSize);

  const seededSlots: (number | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < n; i++) {
    seededSlots[seedPositions[i] - 1] = teamIds[i];
  }

  const firstRoundMatches: KnockoutMatch[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const home = seededSlots[i];
    const away = seededSlots[i + 1];
    if (home !== null && away !== null) {
      firstRoundMatches.push({
        home_team_id: home,
        away_team_id: away,
        bracket_position: i / 2,
      });
    }
  }

  const totalRounds = Math.log2(bracketSize);
  const roundNames = generateRoundNames(totalRounds);

  const rounds: KnockoutRound[] = [];

  rounds.push({
    round_name: roundNames[0],
    matches: firstRoundMatches,
  });

  for (let r = 1; r < totalRounds; r++) {
    const matchesInRound = Math.pow(2, totalRounds - r - 1);
    rounds.push({
      round_name: roundNames[r],
      matches: [],
    });
  }

  return rounds;
}

export function generateTwoLeggedKnockoutBracket(teamIds: number[]): KnockoutRound[] {
  const singleLeg = generateKnockoutBracket(teamIds);
  const result: KnockoutRound[] = [];

  for (const round of singleLeg) {
    result.push({
      round_name: `${round.round_name} (1st Leg)`,
      matches: round.matches.map((m) => ({ ...m, leg: 1 })),
    });
    result.push({
      round_name: `${round.round_name} (2nd Leg)`,
      matches: round.matches.map((m) => ({
        home_team_id: m.away_team_id,
        away_team_id: m.home_team_id,
        bracket_position: m.bracket_position,
        leg: 2,
      })),
    });
  }

  return result;
}

export function generateGroupDraw(
  teamIds: number[],
  numGroups: number
): GroupDrawResult {
  const groups: GroupDrawResult['groups'] = [];
  const groupLetters = 'ABCDEFGHIJKLMNOP';

  for (let g = 0; g < numGroups; g++) {
    groups.push({
      name: groupLetters[g] || `Group ${g + 1}`,
      team_ids: [],
    });
  }

  let groupIndex = 0;
  let direction = 1;
  for (const teamId of teamIds) {
    groups[groupIndex].team_ids.push(teamId);
    const nextIndex = groupIndex + direction;
    if (nextIndex >= numGroups) {
      direction = -1;
    } else if (nextIndex < 0) {
      direction = 1;
    }
    groupIndex += direction;
  }

  return { groups };
}

export function getAdvancingFromGroups(
  standings: Array<{
    group_id: number;
    team_id: number;
    points: number;
    goal_difference: number;
    goals_for: number;
  }>,
  teamsAdvancingPerGroup: number
): Array<{ group_id: number; team_id: number; position: number }> {
  const byGroup = new Map<number, Array<(typeof standings)[0]>>();
  for (const s of standings) {
    if (!byGroup.has(s.group_id)) byGroup.set(s.group_id, []);
    byGroup.get(s.group_id)!.push({ ...s });
  }

  const advancing: Array<{ group_id: number; team_id: number; position: number }> = [];

  const sortedGroups = [...byGroup.entries()].sort(([a], [b]) => a - b);
  for (const [groupId, groupStandings] of sortedGroups) {
    groupStandings.sort(
      (a, b) =>
        b.points - a.points ||
        b.goal_difference - a.goal_difference ||
        b.goals_for - a.goals_for
    );

    for (let i = 0; i < Math.min(teamsAdvancingPerGroup, groupStandings.length); i++) {
      advancing.push({
        group_id: groupId,
        team_id: groupStandings[i].team_id,
        position: i + 1,
      });
    }
  }

  return advancing;
}

export function generateNextKnockoutRound(
  advancingTeams: Array<{ team_id: number }>,
  roundName: string
): KnockoutMatch[] {
  const matches: KnockoutMatch[] = [];
  for (let i = 0; i < advancingTeams.length; i += 2) {
    if (i + 1 < advancingTeams.length) {
      matches.push({
        home_team_id: advancingTeams[i].team_id,
        away_team_id: advancingTeams[i + 1].team_id,
        bracket_position: i / 2,
      });
    }
  }
  return matches;
}

export function groupAdvancingToKnockoutSeedOrder(
  advancing: Array<{ group_id: number; team_id: number; position: number }>
): Array<{ team_id: number }> {
  const firsts = advancing.filter((a) => a.position === 1).sort((a, b) => a.group_id - b.group_id);
  const seconds = advancing.filter((a) => a.position === 2).sort((a, b) => a.group_id - b.group_id);

  const seeded: Array<{ team_id: number }> = [];
  for (let i = 0; i < Math.max(firsts.length, seconds.length); i++) {
    if (i < firsts.length) seeded.push({ team_id: firsts[i].team_id });
    if (i < seconds.length) seeded.push({ team_id: seconds[i].team_id });
  }
  return seeded;
}
