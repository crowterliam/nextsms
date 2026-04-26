import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();

  const managed = await env.DB.prepare(
    `SELECT t.id, t.name, t.abbreviation,
            l.id as league_id, l.name as league_name, l.slug as league_slug
     FROM teams t
     JOIN leagues l ON t.league_id = l.id
     JOIN league_members lm ON l.id = lm.league_id AND lm.user_id = ?
     WHERE t.manager_user_id = ?
     ORDER BY l.name, t.name`
  )
    .bind(user!.id, user!.id)
    .all();

  const administered = await env.DB.prepare(
    `SELECT t.id, t.name, t.abbreviation,
            l.id as league_id, l.name as league_name, l.slug as league_slug,
            lm.role as league_role
     FROM teams t
     JOIN leagues l ON t.league_id = l.id
     JOIN league_members lm ON l.id = lm.league_id AND lm.user_id = ?
     WHERE (lm.role = 'owner' OR lm.role = 'admin')
       AND (t.manager_user_id IS NULL OR t.manager_user_id != ?)
       AND t.league_id IN (SELECT league_id FROM league_members WHERE user_id = ?)
     ORDER BY l.name, t.name`
  )
    .bind(user!.id, user!.id, user!.id)
    .all();

  return NextResponse.json({
    managed: managed.results,
    administered: administered.results,
  });
}
