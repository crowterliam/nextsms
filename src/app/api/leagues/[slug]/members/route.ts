import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth, requireLeagueMember, requireLeagueAdmin, parseJsonBody } from '@/lib/auth-helpers';
import {
  getLeagueMembers, addLeagueMember, updateMemberRole, removeLeagueMember,
  createInvitation, getPendingInvitationsForLeague, updateInvitationStatus,
  assignTeamManager,
} from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();
  const league = await env.DB.prepare('SELECT id, name FROM leagues WHERE slug = ?').bind(slug)
    .first<{ id: string; name: string }>();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const { error: memberError } = await requireLeagueMember(request, league.id, user!.id);
  if (memberError) return memberError;

  const [members, invitations] = await Promise.all([
    getLeagueMembers(env.DB, league.id),
    getPendingInvitationsForLeague(env.DB, league.id),
  ]);

  return NextResponse.json({ members: members.results, invitations: invitations.results });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const { slug } = await params;
  const env = getEnv();
  const league = await env.DB.prepare('SELECT id, name, slug as league_slug FROM leagues WHERE slug = ?').bind(slug)
    .first<{ id: string; name: string; league_slug: string }>();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const { error: adminError } = await requireLeagueAdmin(request, league.id, user!.id);
  if (adminError) return adminError;

  const body = await parseJsonBody(request);
  const action = body.action as string;

  if (action === 'create_invite_link') {
    const { role, team_id, ttl_hours } = body as { role?: string; team_id?: number; ttl_hours?: number };
    const validRoles = ['member', 'admin'];
    const inviteRole = validRoles.includes(role || '') ? role! : 'member';
    const hours = typeof ttl_hours === 'number' && ttl_hours > 0 && ttl_hours <= 720 ? ttl_hours : 168;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const id = crypto.randomUUID();
    await createInvitation(env.DB, {
      id,
      league_id: league.id,
      league_name: league.name,
      league_slug: league.league_slug,
      invited_email: '',
      invited_user_id: null,
      inviter_user_id: user!.id,
      role: inviteRole,
      team_id: team_id && typeof team_id === 'number' && team_id > 0 ? team_id : null,
      type: 'link',
      expires_at: expiresAt,
    });

    const invitations = await getPendingInvitationsForLeague(env.DB, league.id);
    return NextResponse.json({ success: true, token: id, expires_at: expiresAt, invitations: invitations.results });
  }

  // TODO: Email invitations are disabled in the UI until an email delivery service
  // (Resend, SendGrid, Mailgun, etc.) is implemented. This action remains functional
  // for when email sending is wired up. Enable the email invite form in the members
  // page component once ready.
  if (action === 'invite') {
    const { email, role, team_id } = body as { email: string; role: string; team_id?: number };
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const validRoles = ['member', 'admin'];
    const inviteRole = validRoles.includes(role) ? role : 'member';

    const existingMember = await env.DB.prepare(
      'SELECT user_id FROM league_members WHERE league_id = ? AND user_id = (SELECT id FROM "user" WHERE email = ?)'
    ).bind(league.id, normalizedEmail).first();
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }

    const existingInvite = await env.DB.prepare(
      "SELECT id FROM league_invitations WHERE invited_email = ? AND league_id = ? AND status = 'pending'"
    ).bind(normalizedEmail, league.id).first();
    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already pending for this email' }, { status: 409 });
    }

    const targetUser = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(normalizedEmail).first<{ id: string }>();

    const id = crypto.randomUUID();
    await createInvitation(env.DB, {
      id,
      league_id: league.id,
      league_name: league.name,
      league_slug: league.league_slug,
      invited_email: normalizedEmail,
      invited_user_id: targetUser?.id ?? null,
      inviter_user_id: user!.id,
      role: inviteRole,
      team_id: team_id && typeof team_id === 'number' && team_id > 0 ? team_id : null,
      type: 'email',
      expires_at: null,
    });

    const invitations = await getPendingInvitationsForLeague(env.DB, league.id);
    return NextResponse.json({ success: true, invitations: invitations.results });
  }

  if (action === 'cancel_invitation') {
    const { invitation_id } = body as { invitation_id: string };
    if (!invitation_id || typeof invitation_id !== 'string') {
      return NextResponse.json({ error: 'invitation_id required' }, { status: 400 });
    }
    const inv = await env.DB.prepare('SELECT league_id FROM league_invitations WHERE id = ?').bind(invitation_id).first<{ league_id: string }>();
    if (!inv || inv.league_id !== league.id) {
      return NextResponse.json({ error: 'Invitation not found in this league' }, { status: 404 });
    }
    await updateInvitationStatus(env.DB, invitation_id, 'cancelled');
    const invitations = await getPendingInvitationsForLeague(env.DB, league.id);
    return NextResponse.json({ success: true, invitations: invitations.results });
  }

  if (action === 'update_role') {
    const { user_id, role } = body as { user_id: string; role: string };
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }
    const validRoles = ['member', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const target = await env.DB.prepare('SELECT role FROM league_members WHERE league_id = ? AND user_id = ?')
      .bind(league.id, user_id).first<{ role: string }>();
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 403 });
    }
    await updateMemberRole(env.DB, league.id, user_id, role);
    const members = await getLeagueMembers(env.DB, league.id);
    return NextResponse.json({ success: true, members: members.results });
  }

  if (action === 'remove_member') {
    const { user_id } = body as { user_id: string };
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }
    const target = await env.DB.prepare('SELECT role FROM league_members WHERE league_id = ? AND user_id = ?')
      .bind(league.id, user_id).first<{ role: string }>();
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (target.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 });
    }
    await removeLeagueMember(env.DB, league.id, user_id);
    await env.DB.prepare('UPDATE teams SET manager_user_id = NULL WHERE manager_user_id = ? AND league_id = ?').bind(user_id, league.id).run();
    const members = await getLeagueMembers(env.DB, league.id);
    return NextResponse.json({ success: true, members: members.results });
  }

  if (action === 'assign_team') {
    const { user_id, team_id } = body as { user_id: string; team_id: number | null };
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    if (team_id !== null && (typeof team_id !== 'number' || team_id <= 0)) {
      return NextResponse.json({ error: 'Invalid team_id' }, { status: 400 });
    }
    if (team_id !== null) {
      const team = await env.DB.prepare('SELECT id, league_id FROM teams WHERE id = ?').bind(team_id).first<{ id: number; league_id: string | null }>();
      if (!team || team.league_id !== league.id) {
        return NextResponse.json({ error: 'Team not in this league' }, { status: 400 });
      }
    }

    await addLeagueMember(env.DB, league.id, user_id, 'member');

    if (team_id === null) {
      await env.DB.prepare('UPDATE teams SET manager_user_id = NULL WHERE manager_user_id = ? AND league_id = ?').bind(user_id, league.id).run();
    } else {
      await env.DB.prepare('UPDATE teams SET manager_user_id = NULL WHERE manager_user_id = ? AND league_id = ?').bind(user_id, league.id).run();
      await assignTeamManager(env.DB, team_id, user_id);
    }

    const members = await getLeagueMembers(env.DB, league.id);
    return NextResponse.json({ success: true, members: members.results });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
