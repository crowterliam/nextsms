import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth, requireLeagueMember, requireTeamManager, parseJsonBody } from '@/lib/auth-helpers';
import {
  getTeam, getPlayers, getTeamTactics, getSavedLineups, getActiveLineup,
  updateTeamSettings,
} from '@/lib/db';

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

  const { error: memberError, role } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const team = await getTeam(env.DB, teamId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const canManage = role === 'owner' || role === 'admin' ||
    ((team as Record<string, unknown>).manager_user_id === user!.id);

  const players = await getPlayers(env.DB, teamId);
  const tactics = await getTeamTactics(env.DB, teamId);
  const lineups = await getSavedLineups(env.DB, teamId);
  const activeLineup = await getActiveLineup(env.DB, teamId);

  return NextResponse.json({
    team,
    players: players.results,
    tactics: tactics.results,
    lineups: lineups.results,
    activeLineup,
    userRole: role,
    canManage,
  });
}

export async function PATCH(
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
  const allowed = ['default_formation', 'default_tactic', 'default_aggression', 'name', 'abbreviation'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  await updateTeamSettings(env.DB, teamId, updates);
  const team = await getTeam(env.DB, teamId);
  return NextResponse.json({ success: true, team });
}
