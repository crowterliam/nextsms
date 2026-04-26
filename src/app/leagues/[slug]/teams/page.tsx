'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

export default function LeagueTeamsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [slug]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/teams`);
      if (res.ok) setTeams(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, abbreviation: newAbbr.toUpperCase() }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewName('');
        setNewAbbr('');
        fetchTeams();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add team');
      }
    } catch {
      alert('Failed to add team');
    }
    setAdding(false);
  };

  const handleDelete = async (teamId: number) => {
    if (!confirm('Delete this team and all its players?')) return;
    try {
      await fetch(`/api/leagues/${slug}/teams`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
      fetchTeams();
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Teams</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium"
        >
          Add Team
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <form onSubmit={handleAdd} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Team Name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium mb-1 text-muted-foreground">Abbr</label>
              <input type="text" value={newAbbr} onChange={(e) => setNewAbbr(e.target.value.toUpperCase())} required maxLength={4}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button type="submit" disabled={adding} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {adding ? '...' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : teams.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No teams yet. Add teams to get started.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="border border-border rounded-lg bg-card p-4 flex items-center justify-between group hover:border-primary/50 transition-colors">
              <Link href={`/leagues/${slug}/teams/${team.id}`} className="flex-1">
                <p className="font-semibold group-hover:text-primary transition-colors">{team.name}</p>
                <p className="text-sm text-muted-foreground">{team.abbreviation}</p>
              </Link>
              <div className="flex items-center gap-2">
                <Link href={`/leagues/${slug}/teams/${team.id}`}
                  className="text-xs text-primary hover:text-primary-dark px-2 py-1 rounded hover:bg-primary/10 transition-colors">
                  Manage
                </Link>
                <button onClick={() => handleDelete(team.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
