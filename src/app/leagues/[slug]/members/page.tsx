'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';

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
  const [showInvite, setShowInvite] = useState(false);
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

  const handleInvite = async (e: React.FormEvent) => {
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
        setShowInvite(false);
        setInviteEmail('');
        setInviteRole('member');
        setInviteTeamId(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to invite');
      }
    } catch { alert('Failed to invite'); }
    setInviting(false);
  };

  const cancelInvitation = async (invitationId: string) => {
    await fetch(`/api/leagues/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_invitation', invitation_id: invitationId }),
    });
    fetchData();
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
    await fetch(`/api/leagues/${slug}/members`, {
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
          onClick={() => setShowInvite(!showInvite)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium"
        >
          {showInvite ? 'Cancel' : 'Invite Member'}
        </button>
      </div>

      {showInvite && (
        <div className="mb-6 p-5 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">Invite to League</h3>
          <form onSubmit={handleInvite} className="space-y-3">
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

      {invitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Pending Invitations</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border/50">
              {invitations.map(inv => (
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
