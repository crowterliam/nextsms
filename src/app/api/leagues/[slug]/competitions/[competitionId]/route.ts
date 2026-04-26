import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueMember } from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; competitionId: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, competitionId } = await params;
  const compId = parseInt(competitionId);

  const env = getEnv();
  const league = await env.DB.prepare("SELECT id FROM leagues WHERE slug = ?").bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const doStub = getLeagueDO(slug);
  const comp = await doStub.getCompetition(compId);
  if (!comp) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  const stages = await doStub.getCompetitionStages(compId);
  const fixtures = await doStub.getCompetitionFixtures(compId);
  const standings = await doStub.getCompetitionStandings(compId);

  return NextResponse.json({
    competition: comp,
    stages,
    fixtures,
    standings,
  });
}
