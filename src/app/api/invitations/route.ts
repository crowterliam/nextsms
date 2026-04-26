import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getPendingInvitationsForUser, getInvitation, updateInvitationStatus,
  addLeagueMember, assignTeamManager,
} from '@/lib/db';

// TODO: Email-based invitation acceptance (type='email') requires an email delivery
// service to actually send invitation links. Link-based invitations (type='link')
// are the primary flow until that is implemented.

export const runtime = 'edge';

export async function GET(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (token) {
    const invitation = await getInvitation(env.DB, token);
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    const inv = invitation as {
      id: string;
      league_name: string;
      league_slug: string;
      role: string;
      status: string;
      type: string;
      expires_at: string | null;
    };
    if (inv.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
    }
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      await updateInvitationStatus(env.DB, token, 'cancelled');
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }
    return NextResponse.json({
      id: inv.id,
      league_name: inv.league_name,
      league_slug: inv.league_slug,
      role: inv.role,
      type: inv.type,
      expires_at: inv.expires_at,
    });
  }

  const invitations = await getPendingInvitationsForUser(env.DB, user!.id, user!.email);
  return NextResponse.json(invitations.results);
}

export async function POST(request: Request) {
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  const env = getEnv();
  const body = await request.json();
  const { invitation_id, action } = body as { invitation_id: string; action: string };

  if (!invitation_id || typeof invitation_id !== 'string') {
    return NextResponse.json({ error: 'invitation_id required' }, { status: 400 });
  }
  if (!action || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 });
  }

  const invitation = await getInvitation(env.DB, invitation_id);
  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  const inv = invitation as {
    id: string;
    league_id: string;
    invited_email: string;
    invited_user_id: string | null;
    status: string;
    role: string;
    team_id: number | null;
    type: string;
    expires_at: string | null;
  };

  if (inv.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
  }

  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    await updateInvitationStatus(env.DB, invitation_id, 'cancelled');
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
  }

  if (inv.type === 'link') {
    const existingMember = await env.DB.prepare(
      'SELECT user_id FROM league_members WHERE league_id = ? AND user_id = ?'
    ).bind(inv.league_id, user!.id).first();
    if (existingMember) {
      return NextResponse.json({ error: 'Already a member of this league' }, { status: 409 });
    }
  } else {
    const isTargetUser = inv.invited_user_id === user!.id || inv.invited_email === user!.email;
    if (!isTargetUser) {
      return NextResponse.json({ error: 'Not authorized for this invitation' }, { status: 403 });
    }
  }

  if (action === 'reject') {
    await updateInvitationStatus(env.DB, invitation_id, 'rejected');
    const invitations = await getPendingInvitationsForUser(env.DB, user!.id, user!.email);
    return NextResponse.json({ success: true, invitations: invitations.results });
  }

  await addLeagueMember(env.DB, inv.league_id, user!.id, inv.role);

  if (inv.team_id && typeof inv.team_id === 'number' && inv.team_id > 0) {
    await assignTeamManager(env.DB, inv.team_id, user!.id);
  }

  await updateInvitationStatus(env.DB, invitation_id, 'accepted');

  const invitations = await getPendingInvitationsForUser(env.DB, user!.id, user!.email);
  return NextResponse.json({ success: true, invitations: invitations.results });
}
