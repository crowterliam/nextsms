'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/auth-client';

interface League {
  id: string;
  name: string;
  slug: string;
  role: string;
  season: number;
  current_week: number;
  status: string;
}

export default function LeaguesPage() {
  const { data: session } = useSession();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchLeagues();
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch('/api/leagues');
      if (res.ok) {
        setLeagues(await res.json());
      }
    } catch {}
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName('');
        setNewSlug('');
        fetchLeagues();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create league');
      }
    } catch {
      alert('Failed to create league');
    }
    setCreating(false);
  };

  const handleDelete = async (leagueId: string) => {
    if (!confirm('Delete this league and all its data?')) return;
    try {
      await fetch('/api/leagues', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      });
      fetchLeagues();
    } catch {}
  };

  if (!session?.user) {
    return (
      <div className="text-center mt-20">
        <h1 className="text-2xl font-bold mb-4">Your Leagues</h1>
        <p className="text-muted-foreground mb-4">Sign in to manage your leagues.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/login" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark">
            Sign In
          </Link>
          <Link href="/register" className="px-4 py-2 border border-border rounded-lg hover:bg-card">
            Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Leagues</h1>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-muted-foreground">{session.user.email}</span>
          <div className="flex gap-2">
            <Link
              href="/leagues/import"
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 text-sm font-medium"
            >
              Import Legacy
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium"
            >
              New League
            </button>
          </div>
          <button
            onClick={() => signOut()}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Sign Out
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <h2 className="text-lg font-semibold mb-3">Create League</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">League Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="e.g. Sunday League"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">URL Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                placeholder="e.g. sunday-league"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : leagues.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No leagues yet</p>
          <p className="text-sm">Create your first league to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map((league) => (
            <div key={league.id} className="border border-border rounded-lg bg-card p-5 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <Link href={`/leagues/${league.slug}`} className="text-lg font-semibold hover:text-primary">
                  {league.name}
                </Link>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">{league.role}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">/{league.slug}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                <span>Season {league.season}</span>
                <span className="capitalize">{league.status}</span>
              </div>
              {league.role === 'owner' && (
                <button
                  onClick={() => handleDelete(league.id)}
                  className="mt-3 text-xs text-red-400 hover:text-red-300"
                >
                  Delete League
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
