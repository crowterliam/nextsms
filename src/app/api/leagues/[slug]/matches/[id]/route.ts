import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueMember, requireLeagueAdmin } from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, id } = await params;
  const matchId = parseInt(id, 10);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
  }

  const env = getEnv();
  const league = await env.DB.prepare(
    "SELECT id FROM leagues WHERE slug = ?"
  )
    .bind(slug)
    .first<{ id: string }>();

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { error: memberError } = await requireLeagueMember(
    request,
    league.id,
    user!.id
  );
  if (memberError) return memberError;

  const doStub = getLeagueDO(slug);
  const match = await doStub.getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(match);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, id } = await params;
  const matchId = parseInt(id, 10);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
  }

  const env = getEnv();
  const league = await env.DB.prepare(
    "SELECT id FROM leagues WHERE slug = ?"
  )
    .bind(slug)
    .first<{ id: string }>();

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { error: adminError } = await requireLeagueAdmin(
    request,
    league.id,
    user!.id
  );
  if (adminError) return adminError;

  const doStub = getLeagueDO(slug);
  const result = await doStub.deleteMatch(league.id, matchId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}


