import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const env = getEnv();
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const team = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first();
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const players = await env.DB.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY id').bind(teamId).all();
  return NextResponse.json({ team, players: players.results });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  await env.DB.prepare('DELETE FROM players WHERE team_id = ?').bind(teamId).run();
  await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(teamId).run();
  return NextResponse.json({ success: true });
}
