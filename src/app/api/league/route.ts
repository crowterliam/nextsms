import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getLeagueTable, initLeagueTable } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  const env = getEnv();
  const season = 1;

  try {
    await initLeagueTable(env.DB, season);
  } catch {}

  const result = await getLeagueTable(env.DB, season);
  return NextResponse.json(result.results);
}
