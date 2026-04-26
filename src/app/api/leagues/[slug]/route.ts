import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  requireAuth,
  getLeagueDO,
  requireLeagueMember,
} from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();

  const league = await env.DB.prepare(
    "SELECT * FROM leagues WHERE slug = ?"
  )
    .bind(slug)
    .first<{ id: string; name: string; slug: string; owner_id: string; season: number; current_week: number; status: string }>();

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
  const state = await doStub.getState();
  const teams = await doStub.getTeams(league.id);

  return NextResponse.json({
    ...league,
    doState: state,
    teamCount: teams.length,
  });
}
