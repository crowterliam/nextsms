import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueAdmin, requireLeagueMember } from "@/lib/auth-helpers";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();

  const league = await env.DB.prepare("SELECT id FROM leagues WHERE slug = ?").bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const url = new URL(request.url);
  const seasonId = url.searchParams.get("season_id");
  const doStub = getLeagueDO(slug);

  const competitions = await doStub.getCompetitions(league.id, seasonId ? parseInt(seasonId) : undefined);

  const competitionsWithDetails = await Promise.all(
    competitions.map(async (comp) => {
      const stages = await doStub.getCompetitionStages(comp.id as number);
      return { ...comp, stages };
    })
  );

  return NextResponse.json({ competitions: competitionsWithDetails });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();

  const league = await env.DB.prepare("SELECT id FROM leagues WHERE slug = ?").bind(slug).first<{ id: string }>();
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const { error: adminError } = await requireLeagueAdmin(request, league.id, user!.id);
  if (adminError) return adminError;

  const body = await request.json();
  const doStub = getLeagueDO(slug);

  if (body.action === "create") {
    const { name, type, format, season_id, division_id, settings } = body;
    if (!name || typeof name !== "string") return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!type || typeof type !== "string") return NextResponse.json({ error: "Type is required" }, { status: 400 });
    if (!format || typeof format !== "string") return NextResponse.json({ error: "Format is required" }, { status: 400 });
    if (typeof season_id !== "number") return NextResponse.json({ error: "season_id is required" }, { status: 400 });

    const validTypes = ["league", "cup", "supercup", "shield", "playoff", "friendly"];
    const validFormats = ["round_robin", "knockout", "group_knockout", "two_legged_knockout"];
    if (!validTypes.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    if (!validFormats.includes(format)) return NextResponse.json({ error: "Invalid format" }, { status: 400 });

    const result = await doStub.createCompetition(
      league.id, season_id, name, type, format,
      division_id ?? null, settings
    );
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  }

  if (body.action === "delete") {
    const { competition_id } = body;
    if (typeof competition_id !== "number") return NextResponse.json({ error: "competition_id required" }, { status: 400 });
    const result = await doStub.deleteCompetition(competition_id, league.id);
    return NextResponse.json(result);
  }

  if (body.action === "add_stage") {
    const { competition_id, name, format, stage_order, num_groups, teams_advancing, num_legs } = body;
    if (typeof competition_id !== "number") return NextResponse.json({ error: "competition_id required" }, { status: 400 });
    if (!name || typeof name !== "string") return NextResponse.json({ error: "Stage name required" }, { status: 400 });
    if (typeof stage_order !== "number") return NextResponse.json({ error: "stage_order required" }, { status: 400 });

    const result = await doStub.addCompetitionStage(
      competition_id, name, format || "round_robin", stage_order,
      num_groups || 0, teams_advancing || 0, num_legs || 1
    );
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  }

  if (body.action === "generate_fixtures") {
    const { competition_id, team_ids, stage_id } = body;
    if (typeof competition_id !== "number") return NextResponse.json({ error: "competition_id required" }, { status: 400 });

    const result = await doStub.generateCompetitionFixtures(
      competition_id, league.id,
      Array.isArray(team_ids) ? team_ids : undefined,
      typeof stage_id === "number" ? stage_id : undefined
    );
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "advance_week") {
    const { competition_id } = body;
    if (typeof competition_id !== "number") return NextResponse.json({ error: "competition_id required" }, { status: 400 });

    const result = await doStub.advanceCompetitionWeek(competition_id, league.id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
