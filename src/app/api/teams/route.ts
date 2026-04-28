import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { createPlayersBatch } from '@/lib/db';
import { generateRoster } from '@/lib/roster-creator';
import { requireAuth } from '@/lib/auth-helpers';

interface TeamRow {
  id: number;
  name: string;
  abbreviation: string;
}

export const runtime = 'edge';

export async function GET(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const result = await env.DB.prepare('SELECT * FROM teams ORDER BY name').all();
  return NextResponse.json(result.results);
}

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();

  if (body.action === 'generate_roster') {
    const { name, abbreviation, players } = body as { name: string; abbreviation: string; players?: unknown[] };
    if (!name || !abbreviation) {
      return NextResponse.json({ error: 'name and abbreviation required' }, { status: 400 });
    }

    const existing: TeamRow | null = await env.DB.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind(abbreviation).first() as TeamRow | null;
    if (existing) {
      return NextResponse.json({ error: 'abbreviation already exists' }, { status: 409 });
    }

    await env.DB.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').bind(name, abbreviation).run();
    const team: TeamRow = (await env.DB.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind(abbreviation).first()) as TeamRow;

    if (players && Array.isArray(players)) {
      const playerRecords = players.map((p: Record<string, unknown>) => ({
        team_id: team.id,
        name: p.name as string,
        age: p.age as number,
        nationality: p.nationality as string,
        pref_side: p.pref_side as string,
        st: p.st as number,
        tk: p.tk as number,
        ps: p.ps as number,
        sh: p.sh as number,
        sm: p.sm as number,
        ag: p.ag as number,
      }));
      await createPlayersBatch(env.DB, playerRecords);
    } else {
      const roster = generateRoster();
      const playerRecords = roster.players.map((p) => ({
        team_id: team.id,
        name: p.name,
        age: p.age,
        nationality: p.nationality,
        pref_side: p.pref_side,
        st: p.st,
        tk: p.tk,
        ps: p.ps,
        sh: p.sh,
        sm: p.sm,
        ag: p.ag,
      }));
      await createPlayersBatch(env.DB, playerRecords);
    }

    return NextResponse.json({ success: true, team });
  }

  if (body.action === 'delete') {
    const { id } = body as { id: number };
    if (typeof id !== 'number' || id <= 0) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await env.DB.prepare('DELETE FROM players WHERE team_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id).run();
    return NextResponse.json({ success: true });
  }

  const { name, abbreviation } = body as { name: string; abbreviation: string };
  if (!name || !abbreviation) {
    return NextResponse.json({ error: 'name and abbreviation required' }, { status: 400 });
  }

  await env.DB.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').bind(name, abbreviation).run();
  const team: TeamRow = (await env.DB.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind(abbreviation).first()) as TeamRow;
  return NextResponse.json({ success: true, team });
}
