import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth, requireLeagueMember, requireTeamManager } from '@/lib/auth-helpers';
import { getTeamTactics, upsertTeamTactic, deleteTeamTactic } from '@/lib/db';

const VALID_TACTICS = new Set(['N', 'D', 'A', 'C', 'L', 'P']);
const VALID_FORMATIONS = new Set(['433', '442', '451', '352', '343', '532', '541', '4231', '4141', '4222', '3511', '3412', '31312', '32122']);

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

  const tactics = await getTeamTactics(env.DB, teamId);
  return NextResponse.json(tactics.results);
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

  const body = await request.json();
  const { tactic_code, formation, aggression, is_default } = body as {
    tactic_code: string;
    formation: string;
    aggression: number;
    is_default?: boolean;
  };

  if (!tactic_code || !formation) {
    return NextResponse.json({ error: 'tactic_code and formation required' }, { status: 400 });
  }

  const tc = tactic_code.toUpperCase();
  if (!VALID_TACTICS.has(tc)) {
    return NextResponse.json({ error: 'Invalid tactic_code' }, { status: 400 });
  }
  if (!VALID_FORMATIONS.has(formation)) {
    return NextResponse.json({ error: 'Invalid formation' }, { status: 400 });
  }
  if (typeof aggression !== 'number' || aggression < 0 || aggression > 100) {
    return NextResponse.json({ error: 'Aggression must be 0-100' }, { status: 400 });
  }

  await upsertTeamTactic(env.DB, teamId, tc, formation, aggression, is_default ?? false);
  const tactics = await getTeamTactics(env.DB, teamId);
  return NextResponse.json({ success: true, tactics: tactics.results });
}

export async function DELETE(
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

  const body = await request.json();
  const { tactic_id } = body as { tactic_id: number };
  if (typeof tactic_id !== 'number' || tactic_id <= 0) return NextResponse.json({ error: 'tactic_id required' }, { status: 400 });

  await deleteTeamTactic(env.DB, tactic_id, teamId);
  const tactics = await getTeamTactics(env.DB, teamId);
  return NextResponse.json({ success: true, tactics: tactics.results });
}
