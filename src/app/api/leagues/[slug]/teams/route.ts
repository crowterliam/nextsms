import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  requireAuth,
  getLeagueDO,
  requireLeagueAdmin,
  requireLeagueMember,
  parseJsonBody,
} from "@/lib/auth-helpers";

const PLACEHOLDER_TEAM_NAMES = [
  "Red Lions", "Blue Eagles", "Green Dragons", "Golden Hawks",
  "Silver Wolves", "Black Panthers", "White Tigers", "Crimson Bears",
  "Azure Foxes", "Emerald Sharks", "Amber Falcons", "Slate Vipers",
  "Ivory Rhinos", "Scarlet Ravens", "Teal Cobras", "Jade Stallions",
  "Bronze Owls", "Onyx Lynx", "Pearl Bison", "Copper Jaguars",
];

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
  const teams = await doStub.getTeams(league.id);
  return NextResponse.json(teams);
}

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

  const body = await parseJsonBody(request);

  if (body.action === "generate_placeholder") {
    const count = typeof body.count === "number" && body.count > 0 && body.count <= 20
      ? body.count
      : 6;

    const existingTeams = await env.DB.prepare(
      "SELECT name, abbreviation FROM teams WHERE league_id = ?"
    )
      .bind(league.id)
      .all<{ name: string; abbreviation: string }>();

    const usedNames = new Set((existingTeams.results || []).map((t) => t.name));
    const usedAbbrs = new Set((existingTeams.results || []).map((t) => t.abbreviation));

    const available = PLACEHOLDER_TEAM_NAMES.filter((n) => !usedNames.has(n));
    const toCreate = available.slice(0, count);

    if (toCreate.length === 0) {
      return NextResponse.json(
        { error: "No more placeholder team names available" },
        { status: 400 }
      );
    }

    const doStub = getLeagueDO(slug);
    const created: Array<{ name: string; abbreviation: string }> = [];

    for (const teamName of toCreate) {
      let abbr = teamName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3);
      let suffix = 0;
      let finalAbbr = abbr;
      while (usedAbbrs.has(finalAbbr)) {
        suffix++;
        finalAbbr = abbr + suffix;
      }
      usedAbbrs.add(finalAbbr);

      const result = await doStub.addTeam(teamName, finalAbbr, league.id);
      if (result.success && result.team) {
        created.push({ name: result.team.name, abbreviation: result.team.abbreviation });
      }
    }

    return NextResponse.json({ success: true, created, count: created.length });
  }

  const { name, abbreviation, manager_user_id } = body as {
    name: string;
    abbreviation: string;
    manager_user_id?: string;
  };

  if (!name || !abbreviation) {
    return NextResponse.json(
      { error: "name and abbreviation required" },
      { status: 400 }
    );
  }

  if (name.length > 100 || abbreviation.length > 10) {
    return NextResponse.json({ error: 'Name must be 100 chars or less, abbreviation 10 chars or less' }, { status: 400 });
  }

  const doStub = getLeagueDO(slug);
  const result = await doStub.addTeam(name, abbreviation, league.id, manager_user_id);
  if (result.success && manager_user_id) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO league_members (league_id, user_id, role) VALUES (?, ?, 'member')"
    ).bind(league.id, manager_user_id).run();
  }
  return NextResponse.json(result);
}

export async function DELETE(
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

  const body = await parseJsonBody(request);
  const { teamId } = body as { teamId: number };
  if (typeof teamId !== 'number' || teamId <= 0) {
    return NextResponse.json(
      { error: "teamId required" },
      { status: 400 }
    );
  }

  const doStub = getLeagueDO(slug);
  const result = await doStub.removeTeam(teamId);
  return NextResponse.json(result);
}
