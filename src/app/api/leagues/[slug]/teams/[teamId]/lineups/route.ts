import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth, requireLeagueMember, requireTeamManager, parseJsonBody } from '@/lib/auth-helpers';
import {
  getSavedLineups, saveLineup, updateSavedLineup, activateLineup, deleteSavedLineup,
  getPlayers, getTeam,
} from '@/lib/db';
import { createTeamsheet, teamsheetToLineup } from '@/lib/teamsheet-creator';
import type { Player } from '@/lib/types';

const VALID_TACTICS = new Set(['N', 'D', 'A', 'C', 'L', 'P']);

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, teamId: teamIdStr } = await params;
  const teamId = parseInt(teamIdStr, 10);
  if (isNaN(teamId)) return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });

  const env = getEnv();
  const league = await env.DB.prepare('SELECT id FROM leagues WHERE slug = ?').bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const lineups = await getSavedLineups(env.DB, teamId);
  return NextResponse.json(lineups.results);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, teamId: teamIdStr } = await params;
  const teamId = parseInt(teamIdStr, 10);
  if (isNaN(teamId)) return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });

  const env = getEnv();
  const league = await env.DB.prepare('SELECT id FROM leagues WHERE slug = ?').bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const { error: memberError } = await requireTeamManager(request, league.id, user!.id, teamId);
  if (memberError) return memberError;

  const body = await parseJsonBody(request);

  if (body.action === 'auto_generate') {
    const formation = (body.formation as string) || '442';
    const tacticCode = (body.tactic_code as string) || 'N';
    const aggression = typeof body.aggression === 'number' ? body.aggression : 50;
    const name = (body.name as string) || `${formation}${tacticCode}`;

    const playersResult = await getPlayers(env.DB, teamId);
    if (!playersResult.results?.length) {
      return NextResponse.json({ error: 'No players' }, { status: 400 });
    }
    const roster = playersResult.results as Player[];
    const sheet = createTeamsheet(roster, `${formation}${tacticCode}`, '', 5);
    const { lineup, penalty_taker } = teamsheetToLineup(sheet);

    await saveLineup(env.DB, {
      team_id: teamId,
      name,
      formation,
      tactic_code: tacticCode,
      aggression,
      lineup: JSON.stringify(lineup),
      conditionals: '[]',
      penalty_taker_id: penalty_taker ? roster.find(p => p.name === penalty_taker)?.id ?? null : null,
      is_active: body.set_active ? 1 : 0,
    });

    const lineups = await getSavedLineups(env.DB, teamId);
    return NextResponse.json({ success: true, lineups: lineups.results });
  }

  if (body.action === 'activate') {
    const { lineup_id } = body as { lineup_id: number };
    if (typeof lineup_id !== 'number' || lineup_id <= 0) return NextResponse.json({ error: 'lineup_id required' }, { status: 400 });
    await activateLineup(env.DB, lineup_id, teamId);
    const lineups = await getSavedLineups(env.DB, teamId);
    return NextResponse.json({ success: true, lineups: lineups.results });
  }

  if (body.action === 'delete') {
    const { lineup_id } = body as { lineup_id: number };
    if (typeof lineup_id !== 'number' || lineup_id <= 0) return NextResponse.json({ error: 'lineup_id required' }, { status: 400 });
    await deleteSavedLineup(env.DB, lineup_id, teamId);
    const lineups = await getSavedLineups(env.DB, teamId);
    return NextResponse.json({ success: true, lineups: lineups.results });
  }

  if (body.action === 'update_conditionals') {
    const { lineup_id, conditionals } = body as { lineup_id: number; conditionals: string };
    if (typeof lineup_id !== 'number' || lineup_id <= 0) return NextResponse.json({ error: 'lineup_id required' }, { status: 400 });
    const condStr = typeof conditionals === 'string' ? conditionals : JSON.stringify(conditionals || '[]');
    if (condStr.length > 10000) return NextResponse.json({ error: 'Conditionals data too large' }, { status: 400 });
    await updateSavedLineup(env.DB, lineup_id, teamId, { conditionals: condStr });
    const lineups = await getSavedLineups(env.DB, teamId);
    return NextResponse.json({ success: true, lineups: lineups.results });
  }

  if (body.action === 'update_lineup') {
    const { lineup_id, formation, tactic_code, aggression, lineup, name } = body as {
      lineup_id: number;
      formation?: string;
      tactic_code?: string;
      aggression?: number;
      lineup?: string;
      name?: string;
    };
    if (typeof lineup_id !== 'number' || lineup_id <= 0) return NextResponse.json({ error: 'lineup_id required' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (formation) updates.formation = formation;
    if (tactic_code) updates.tactic_code = tactic_code;
    if (typeof aggression === 'number') updates.aggression = aggression;
    if (name) updates.name = name;

    if (lineup) {
      const lineupStr = typeof lineup === 'string' ? lineup : JSON.stringify(lineup);
      if (lineupStr.length > 10000) {
        return NextResponse.json({ error: 'Lineup data too large' }, { status: 400 });
      }
      updates.lineup = lineupStr;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await updateSavedLineup(env.DB, lineup_id, teamId, updates);
    const lineups = await getSavedLineups(env.DB, teamId);
    return NextResponse.json({ success: true, lineups: lineups.results });
  }

  const { name, formation, tactic_code, aggression, lineup, conditionals, penalty_taker_id, is_active } = body as {
    name: string;
    formation: string;
    tactic_code: string;
    aggression?: number;
    lineup: string;
    conditionals?: string;
    penalty_taker_id?: number | null;
    is_active?: boolean;
  };

  if (!name || !formation || !tactic_code || !lineup) {
    return NextResponse.json({ error: 'name, formation, tactic_code, lineup required' }, { status: 400 });
  }
  if (!VALID_TACTICS.has(tactic_code.toUpperCase())) {
    return NextResponse.json({ error: 'Invalid tactic_code' }, { status: 400 });
  }

  const lineupStr = typeof lineup === 'string' ? lineup : JSON.stringify(lineup);
  const condStr = typeof conditionals === 'string' ? conditionals : JSON.stringify(conditionals || []);
  if (lineupStr.length > 10000) {
    return NextResponse.json({ error: 'Lineup data too large' }, { status: 400 });
  }
  if (condStr.length > 10000) {
    return NextResponse.json({ error: 'Conditionals data too large' }, { status: 400 });
  }

  await saveLineup(env.DB, {
    team_id: teamId,
    name,
    formation,
    tactic_code,
    aggression: typeof aggression === 'number' ? aggression : 50,
    lineup: typeof lineup === 'string' ? lineup : JSON.stringify(lineup),
    conditionals: typeof conditionals === 'string' ? conditionals : JSON.stringify(conditionals || []),
    penalty_taker_id: penalty_taker_id ?? null,
    is_active: is_active ? 1 : 0,
  });

  const lineups = await getSavedLineups(env.DB, teamId);
  return NextResponse.json({ success: true, lineups: lineups.results });
}
