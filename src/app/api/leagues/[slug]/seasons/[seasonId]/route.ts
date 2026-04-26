import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAuth, getLeagueDO, requireLeagueAdmin, requireLeagueMember } from "@/lib/auth-helpers";

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
  const history = await doStub.getSeasonHistory(league.id, parseInt(seasonId));

  return NextResponse.json({ history });
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

  const body = await request.json().catch(() => ({}));
  const doStub = getLeagueDO(slug);

  if (body.action === "complete") {
    const result = await doStub.completeCurrentSeason(league.id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
