import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueAdmin } from "@/lib/auth-helpers";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
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
  const state = await doStub.getState();
  if (!state?.seasonId) {
    return NextResponse.json({ error: "No active season. Create a season first." }, { status: 400 });
  }
  const result = await doStub.advanceWeek(league.id);
  return NextResponse.json(result);
}
