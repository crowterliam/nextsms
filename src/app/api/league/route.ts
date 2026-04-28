import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getLeagueTable, initLeagueTable } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const season = 1;

  try {
    await initLeagueTable(env.DB, season);
  } catch {}

  const result = await getLeagueTable(env.DB, season);
  return NextResponse.json(result.results);
}
