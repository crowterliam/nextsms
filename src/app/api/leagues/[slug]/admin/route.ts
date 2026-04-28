import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueAdmin, parseJsonBody } from "@/lib/auth-helpers";

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

  const body = (await parseJsonBody(request)) as {
    action: string;
    fixture_id?: number;
    week?: number;
    match_ids?: number[];
    match_id?: number;
    home_score?: number;
    away_score?: number;
  };
  const doStub = getLeagueDO(slug);

  switch (body.action) {
    case "reset_fixture": {
      if (typeof body.fixture_id !== "number" || body.fixture_id <= 0) {
        return NextResponse.json({ error: "fixture_id required" }, { status: 400 });
      }
      const result = await doStub.resetFixture(league.id, body.fixture_id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    case "reset_week": {
      if (typeof body.week !== "number" || body.week <= 0) {
        return NextResponse.json({ error: "week required" }, { status: 400 });
      }
      const result = await doStub.bulkResetWeek(league.id, body.week);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, resetCount: result.resetCount });
    }

    case "reset_all": {
      const result = await doStub.resetAllFixtures(league.id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    case "delete_matches": {
      if (!Array.isArray(body.match_ids) || !body.match_ids.length) {
        return NextResponse.json({ error: "match_ids array required" }, { status: 400 });
      }
      if (!body.match_ids.every((id: unknown) => typeof id === "number" && Number.isInteger(id) && id > 0)) {
        return NextResponse.json({ error: "match_ids must be positive integers" }, { status: 400 });
      }
      const result = await doStub.bulkDeleteMatches(league.id, body.match_ids);
      return NextResponse.json({ success: true, deletedCount: result.deletedCount });
    }

    case "edit_score": {
      if (typeof body.match_id !== "number" || body.match_id <= 0) {
        return NextResponse.json({ error: "match_id required" }, { status: 400 });
      }
      if (typeof body.home_score !== "number" || typeof body.away_score !== "number"
        || !Number.isInteger(body.home_score) || !Number.isInteger(body.away_score)
        || body.home_score < 0 || body.away_score < 0
        || body.home_score > 99 || body.away_score > 99) {
        return NextResponse.json({ error: "Valid integer home_score and away_score required (0-99)" }, { status: 400 });
      }
      const result = await doStub.editMatchScore(league.id, body.match_id, body.home_score, body.away_score);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    case "resimulate": {
      if (typeof body.fixture_id !== "number" || body.fixture_id <= 0) {
        return NextResponse.json({ error: "fixture_id required" }, { status: 400 });
      }
      const resetResult = await doStub.resetFixture(league.id, body.fixture_id);
      if (!resetResult.success) {
        return NextResponse.json({ error: resetResult.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "Fixture reset. Use Play Next Week or advance to resimulate." });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
