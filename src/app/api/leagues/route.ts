import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  requireAuth,
  getLeagueDO,
  requireLeagueMember,
} from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const result = await env.DB.prepare(
    `SELECT l.*, lm.role
     FROM leagues l
     JOIN league_members lm ON l.id = lm.league_id
     WHERE lm.user_id = ?
     ORDER BY l.created_at DESC`
  )
    .bind(user!.id)
    .all();

  return NextResponse.json(result.results);
}

export async function POST(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { name, slug } = body as { name: string; slug: string };

  if (!name || !slug) {
    return NextResponse.json(
      { error: "name and slug required" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be lowercase alphanumeric with hyphens" },
      { status: 400 }
    );
  }

  const env = getEnv();

  const existing = await env.DB.prepare(
    "SELECT id FROM leagues WHERE slug = ?"
  )
    .bind(slug)
    .first();
  if (existing) {
    return NextResponse.json(
      { error: "League slug already taken" },
      { status: 409 }
    );
  }

  const leagueId = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO leagues (id, name, slug, owner_id) VALUES (?, ?, ?, ?)"
  )
    .bind(leagueId, name, slug, user!.id)
    .run();

  await env.DB.prepare(
    "INSERT INTO league_members (league_id, user_id, role) VALUES (?, ?, 'owner')"
  )
    .bind(leagueId, user!.id)
    .run();

  const doStub = getLeagueDO(slug);
  await doStub.init(name, slug);

  return NextResponse.json({
    success: true,
    league: { id: leagueId, name, slug },
  });
}

export async function DELETE(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { leagueId } = body as { leagueId: string };
  if (!leagueId) {
    return NextResponse.json(
      { error: "leagueId required" },
      { status: 400 }
    );
  }

  const env = getEnv();
  const league = await env.DB.prepare(
    "SELECT id, slug, owner_id FROM leagues WHERE id = ?"
  )
    .bind(leagueId)
    .first<{ id: string; slug: string; owner_id: string }>();

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }
  if (league.owner_id !== user!.id) {
    return NextResponse.json(
      { error: "Only the owner can delete a league" },
      { status: 403 }
    );
  }

  const doStub = getLeagueDO(league.slug);
  await doStub.destroy(leagueId);

  await env.DB.prepare("DELETE FROM league_members WHERE league_id = ?")
    .bind(leagueId)
    .run();
  await env.DB.prepare("DELETE FROM leagues WHERE id = ?")
    .bind(leagueId)
    .run();

  return NextResponse.json({ success: true });
}
