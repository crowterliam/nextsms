import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { setConfigBatch } from '@/lib/db';
import { generateRoster } from '@/lib/roster-creator';
import { requireAuth } from '@/lib/auth-helpers';

interface TeamRow {
  id: number;
  name: string;
  abbreviation: string;
}

export const runtime = 'edge';

export async function POST(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();

  const configEntries: Array<[string, string]> = [
    ['HOME_BONUS', '200'],
    ['DP_FOR_YELLOW', '4'],
    ['DP_FOR_RED', '10'],
    ['SUSPENSION_MARGIN', '10'],
    ['MAX_INJURY_LENGTH', '9'],
    ['NUM_SUBS', '5'],
    ['SUBSTITUTIONS', '3'],
    ['UPDTR_FITNESS_GAIN', '20'],
    ['UPDTR_FITNESS_AFTER_INJURY', '80'],
    ['AB_GOAL', '50'],
    ['AB_ASSIST', '35'],
    ['AB_VICTORY_RANDOM', '60'],
    ['AB_CLEAN_SHEET', '50'],
    ['AB_KTK', '18'],
    ['AB_KPS', '12'],
    ['AB_SHT_ON', '2'],
    ['AB_SHT_OFF', '0'],
    ['AB_SAV', '12'],
    ['AB_DEFEAT_RANDOM', '-60'],
    ['AB_CONCEDE', '-8'],
    ['AB_YELLOW', '-8'],
    ['AB_RED', '-20'],
  ];

  const existing = await env.DB.prepare('SELECT * FROM teams').all();
  if (existing.results && existing.results.length === 0) {
    await setConfigBatch(env.DB, configEntries);

    await env.DB.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').bind('Apes United', 'APE').run();
    const ape: TeamRow = (await env.DB.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind('APE').first()) as TeamRow;
    if (ape) await seedSampleRoster(env, ape.id);

    await env.DB.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').bind('KLM Royal Club', 'KLM').run();
    const klm: TeamRow = (await env.DB.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind('KLM').first()) as TeamRow;
    if (klm) await seedSampleRoster(env, klm.id);

    await env.DB.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').bind('Universidad De Valladolid', 'UVA').run();
    const uva: TeamRow = (await env.DB.prepare('SELECT * FROM teams WHERE abbreviation = ?').bind('UVA').first()) as TeamRow;
    if (uva) await seedSampleRoster(env, uva.id);
  }

  return NextResponse.json({ success: true, message: 'Database seeded with default config and sample teams' });
}

async function seedSampleRoster(env: CloudflareEnv, teamId: number) {
  const roster = generateRoster();
  const stmt = env.DB.prepare(
    'INSERT INTO players (team_id, name, age, nationality, pref_side, st, tk, ps, sh, sm, ag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const batch = roster.players.map((p) =>
    stmt.bind(teamId, p.name, p.age, p.nationality, p.pref_side, p.st, p.tk, p.ps, p.sh, p.sm, p.ag)
  );
  await env.DB.batch(batch);
}
