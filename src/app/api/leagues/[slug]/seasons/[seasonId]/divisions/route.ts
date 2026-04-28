import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueAdmin, requireLeagueMember, parseJsonBody } from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; seasonId: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, seasonId } = await params;
  const env = getEnv();

  const league = await env.DB.prepare("SELECT id FROM leagues WHERE slug = ?").bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const doStub = getLeagueDO(slug);
  const sid = parseInt(seasonId, 10);
  if (isNaN(sid)) return NextResponse.json({ error: "Invalid season ID" }, { status: 400 });
  const divisions = await doStub.getDivisions(league.id, sid);

  const divisionsWithTeams = await Promise.all(
    divisions.map(async (div) => {
      const teams = await doStub.getDivisionTeams(div.id as number);
      return { ...div, teams };
    })
  );

  return NextResponse.json({ divisions: divisionsWithTeams });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; seasonId: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug, seasonId } = await params;
  const env = getEnv();

  const league = await env.DB.prepare("SELECT id FROM leagues WHERE slug = ?").bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const { error: adminError } = await requireLeagueAdmin(request, league.id, user!.id);
  if (adminError) return adminError;

  const body = await parseJsonBody(request);
  const doStub = getLeagueDO(slug);
  const sid = parseInt(seasonId, 10);
  if (isNaN(sid)) return NextResponse.json({ error: "Invalid season ID" }, { status: 400 });

  if (body.action === "create") {
    const { name, level, promotion_spots, relegation_spots, playoff_spots } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      return NextResponse.json({ error: "Division name is required" }, { status: 400 });
    }
    if (typeof level !== "number" || level < 1) {
      return NextResponse.json({ error: "Level must be a positive number" }, { status: 400 });
    }
    const result = await doStub.createDivision(
      league.id, sid, name.trim(), level,
      promotion_spots || 0, relegation_spots || 0, playoff_spots || 0
    );
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  }

  if (body.action === "assign_team") {
    const { division_id, team_id } = body;
    if (typeof division_id !== "number" || division_id <= 0 || typeof team_id !== "number" || team_id <= 0) {
      return NextResponse.json({ error: "division_id and team_id required" }, { status: 400 });
    }
    const result = await doStub.assignTeamToDivision(division_id, team_id, sid);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "remove_team") {
    const { division_id, team_id } = body;
    if (typeof division_id !== "number" || division_id <= 0 || typeof team_id !== "number" || team_id <= 0) {
      return NextResponse.json({ error: "division_id and team_id required" }, { status: 400 });
    }
    await doStub.removeTeamFromDivision(division_id, team_id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "auto_assign") {
    const result = await doStub.autoAssignDivisions(league.id, sid);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "delete") {
    const { division_id } = body;
    if (typeof division_id !== "number" || division_id <= 0) {
      return NextResponse.json({ error: "division_id required" }, { status: 400 });
    }
    await doStub.deleteDivision(division_id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
