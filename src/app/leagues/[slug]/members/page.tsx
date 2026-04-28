
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { safeFetch } from '@/lib/fetch';

interface Member {
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  managed_team_id: number | null;
  managed_team_name: string | null;
}

interface Invitation {
  id: string;
  invited_email: string;
  inviter_name: string;
  role: string;
  team_id: number | null;
  type: string;
  expires_at: string | null;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

export default function MembersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: session } = useSession();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [linkRole, setLinkRole] = useState('member');
  const [linkTeamId, setLinkTeamId] = useState<number | null>(null);
  const [linkTtlHours, setLinkTtlHours] = useState(168);
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  /* TODO: Email invitations are disabled until an email service (e.g. Resend, SendGrid, Mailgun)
     is implemented. The email invite flow is preserved in the API route
     (POST /api/leagues/[slug]/members action='invite') and the invitations API
     (GET/POST /api/invitations). Enable the UI below once email delivery is wired up.
     See also: src/app/api/leagues/[slug]/members/route.ts action === 'invite' */

  const [showEmailInvite, setShowEmailInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteTeamId, setInviteTeamId] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);

  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignTeamId, setAssignTeamId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, teamsRes] = await Promise.all([
        fetch(`/api/leagues/${slug}/members`),
        fetch(`/api/leagues/${slug}/teams`),
      ]);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
      }
      if (teamsRes.ok) setTeams(await teamsRes.json());
    } catch {}
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setGeneratedLink('');
    try {
      const res = await fetch(`/api/leagues/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_invite_link',
          role: linkRole,
          team_id: linkTeamId,
          ttl_hours: linkTtlHours,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
        const origin = window.location.origin;
        setGeneratedLink(`${origin}/leagues/${slug}/join?token=${data.token}`);
        setShowCreateLink(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create link');
      }
    } catch { alert('Failed to create link'); }
    setCreating(false);
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cancelInvitation = async (invitationId: string) => {
    await fetch(`/api/leagues/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_invitation', invitation_id: invitationId }),
    });
    setGeneratedLink('');
    fetchData();
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          team_id: inviteTeamId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
        setShowEmailInvite(false);
        setInviteEmail('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to invite');
      }
    } catch { alert('Failed to invite'); }
    setInviting(false);
  };

  const updateRole = async (userId: string, role: string) => {
    await fetch(`/api/leagues/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_role', user_id: userId, role }),
    });
    fetchData();
  };

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member from the league?')) return;
    await safeFetch(`/api/leagues/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', user_id: userId }),
    });
    fetchData();
  };

  const assignTeam = async (userId: string, teamId: number | null) => {
    await fetch(`/api/leagues/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_team', user_id: userId, team_id: teamId }),
    });
    setAssigningUserId(null);
    setAssignTeamId(null);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const linkInvitations = invitations.filter(i => i.type === 'link');
  const emailInvitations = invitations.filter(i => i.type === 'email');

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
        <span>/</span>
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Members</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members &amp; Invitations</h1>
        <button
          onClick={() => { setShowCreateLink(!showCreateLink); setShowEmailInvite(false); }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium"
        >
          {showCreateLink ? 'Cancel' : 'Create Invite Link'}
        </button>
      </div>

      {showCreateLink && (
        <div className="mb-6 p-5 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">Create Invite Link</h3>
          <form onSubmit={handleCreateLink} className="space-y-3">
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Role</label>
                <select value={linkRole} onChange={e => setLinkRole(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Assign Team</label>
                <select value={linkTeamId ?? ''} onChange={e => setLinkTeamId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="">No team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Expires in</label>
                <select value={linkTtlHours} onChange={e => setLinkTtlHours(parseInt(e.target.value))}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                  <option value={336}>14 days</option>
                  <option value={720}>30 days</option>
                </select>
              </div>
              <button type="submit" disabled={creating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? 'Creating...' : 'Generate Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {generatedLink && (
        <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5">
          <h3 className="font-semibold mb-2">Invite Link Created</h3>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={generatedLink}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono truncate" />
            <button onClick={() => copyLink(generatedLink)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium whitespace-nowrap">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Share this link with anyone you want to invite. Anyone with this link can join the league.
          </p>
        </div>
      )}

      {linkInvitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Active Invite Links</h2>
          <div className="space-y-2">
            {linkInvitations.map(inv => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const link = `${origin}/leagues/${slug}/join?token=${inv.id}`;
              const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
              return (
                <div key={inv.id} className={`px-4 py-3 border rounded-lg ${expired ? 'border-border/50 bg-muted/20 opacity-60' : 'border-border bg-card'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {inv.role === 'admin' ? 'Admin' : 'Member'} invite
                        {inv.team_id ? ` — ${teams.find(t => t.id === inv.team_id)?.name || `Team #${inv.team_id}`}` : ''}
                        {expired ? ' (expired)' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.expires_at
                          ? `Expires: ${new Date(inv.expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}`
                          : 'No expiry'}
                        {` · Created ${new Date(inv.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!expired && (
                        <button onClick={() => copyLink(link)}
                          className="text-xs text-primary hover:text-primary-dark px-3 py-1 border border-border rounded-lg">
                          Copy Link
                        </button>
                      )}
                      <button onClick={() => cancelInvitation(inv.id)}
                        className="text-xs text-destructive hover:text-destructive-dark px-3 py-1 border border-border rounded-lg">
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TODO: Email invitations disabled — enable this section and the handler below
           once an email delivery service is configured (Resend, SendGrid, Mailgun, etc.) */}
      {emailInvitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Email Invitations</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border/50">
              {emailInvitations.map(inv => (
                <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{inv.invited_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: <span className="capitalize">{inv.role}</span>
                      {inv.team_id ? ` · Team: ${teams.find(t => t.id === inv.team_id)?.name || `#${inv.team_id}`}` : ''}
                      {` · Invited by ${inv.inviter_name}`}
                    </p>
                  </div>
                  <button onClick={() => cancelInvitation(inv.id)}
                    className="text-xs text-destructive hover:text-destructive-dark px-3 py-1 border border-border rounded-lg hover:bg-card">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TODO: Email invite form disabled until email service is implemented.
           The API endpoint (action='invite') is fully functional and will send
           actual emails once a provider is wired up. Uncomment to enable UI. */}
      {showEmailInvite && (
        <div className="mb-6 p-5 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">Invite by Email</h3>
          <form onSubmit={handleEmailInvite} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email Address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@example.com" />
            </div>
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Assign Team (optional)</label>
                <select value={inviteTeamId ?? ''} onChange={e => setInviteTeamId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="">No team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={inviting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Members ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No members found.</p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">User</th>
                    <th className="px-3 py-2.5 text-left font-medium">Email</th>
                    <th className="px-3 py-2.5 text-center font-medium">Role</th>
                    <th className="px-3 py-2.5 text-left font-medium">Managed Team</th>
                    <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">{m.email}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.role === 'owner' ? 'bg-primary/10 text-primary' :
                          m.role === 'admin' ? 'bg-accent/10 text-accent' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {assigningUserId === m.user_id ? (
                          <div className="flex items-center gap-2">
                            <select value={assignTeamId ?? ''} onChange={e => setAssignTeamId(e.target.value ? parseInt(e.target.value) : null)}
                              className="px-2 py-1 bg-background border border-border rounded text-xs">
                              <option value="">No team</option>
                              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <button onClick={() => assignTeam(m.user_id, assignTeamId)}
                              className="text-xs text-primary hover:text-primary-dark">Save</button>
                            <button onClick={() => { setAssigningUserId(null); setAssignTeamId(null); }}
                              className="text-xs text-muted-foreground">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setAssigningUserId(m.user_id); setAssignTeamId(m.managed_team_id); }}
                            className="text-sm text-primary hover:text-primary-dark">
                            {m.managed_team_name || 'Assign team'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {m.role !== 'owner' && (
                            <>
                              {m.role === 'member' ? (
                                <button onClick={() => updateRole(m.user_id, 'admin')}
                                  className="text-xs text-primary hover:text-primary-dark">Make Admin</button>
                              ) : (
                                <button onClick={() => updateRole(m.user_id, 'member')}
                                  className="text-xs text-muted-foreground hover:text-foreground">Make Member</button>
                              )}
                              <button onClick={() => removeMember(m.user_id)}
                                className="text-xs text-destructive hover:text-destructive-dark">Remove</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
