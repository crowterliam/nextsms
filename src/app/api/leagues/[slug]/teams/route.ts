import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  requireAuth,
  getLeagueDO,
  requireLeagueAdmin,
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

  const body = await request.json();
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

  const body = await request.json();
  const { teamId } = body as { teamId: number };
  if (!teamId) {
    return NextResponse.json(
      { error: "teamId required" },
      { status: 400 }
    );
  }

  const doStub = getLeagueDO(slug);
  const result = await doStub.removeTeam(teamId);
  return NextResponse.json(result);
}

async function requireLeagueMember(
  request: Request,
  leagueId: string,
  userId: string
) {
  const env = getEnv();
  const member = await env.DB.prepare(
    "SELECT role FROM league_members WHERE league_id = ? AND user_id = ?"
  )
    .bind(leagueId, userId)
    .first<{ role: string }>();

  if (!member) {
    return {
      error: NextResponse.json(
        { error: "Not a member of this league" },
        { status: 403 }
      ),
    };
  }
  return { error: null };
}
