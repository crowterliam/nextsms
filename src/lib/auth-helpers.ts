import { createAuth } from "./auth";
import { getEnv } from "./env";
import { NextResponse } from "next/server";

export async function getSession(request: Request) {
  const auth = createAuth();
  return auth.api.getSession({ headers: request.headers });
}

export async function requireAuth(request: Request) {
  const session = await getSession(request);
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      session: null,
    };
  }
  return { error: null, user: session.user, session: session.session };
}

export function getLeagueDO(slug: string) {
  const env = getEnv();
  const id = env.LEAGUE_DO.idFromName(slug);
  return env.LEAGUE_DO.get(id);
}

export async function requireLeagueMember(
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
      role: null,
    };
  }
  return { error: null, role: member.role };
}

export async function requireLeagueAdmin(
  request: Request,
  leagueId: string,
  userId: string
) {
  const { error, role } = await requireLeagueMember(request, leagueId, userId);
  if (error) return { error, role: null };
  if (role !== "owner" && role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
      role: null,
    };
  }
  return { error: null, role };
}

export async function requireTeamManager(
  request: Request,
  leagueId: string,
  userId: string,
  teamId: number
) {
  const { error, role } = await requireLeagueMember(request, leagueId, userId);
  if (error) return { error, role: null };

  if (role === "owner" || role === "admin") {
    return { error: null, role };
  }

  const env = getEnv();
  const team = await env.DB.prepare(
    "SELECT manager_user_id FROM teams WHERE id = ?"
  )
    .bind(teamId)
    .first<{ manager_user_id: string | null }>();

  if (!team || team.manager_user_id !== userId) {
    return {
      error: NextResponse.json(
        { error: "You are not the manager of this team" },
        { status: 403 }
      ),
      role: null,
    };
  }

  return { error: null, role };
}
