'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/fetch';

interface Season {
  id: number;
  season_number: number;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function SeasonsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { fetchSeasons(); }, [slug]);

  const fetchSeasons = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/seasons`);
      if (res.ok) {
        const data = await res.json();
        setSeasons(data.seasons || []);
        setCurrentSeason(data.currentSeason);
      } else setError('Failed to load seasons');
    } catch { setError('Failed to load seasons'); }
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await safeFetch(`/api/leagues/${slug}/seasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || undefined }),
      });
      if (res.ok) {
        setShowNewForm(false);
        setNewName('');
        fetchSeasons();
      }
    } catch {}
    setCreating(false);
  };

  const handleComplete = async (seasonId: number) => {
    if (!confirm('Complete this season? This will archive all data and allow starting a new season.')) return;
    try {
      const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (res.ok) fetchSeasons();
      else {
        const data = await res.json();
        alert(data.error || 'Failed to complete season');
      }
    } catch {}
  };

  const statusColors: Record<string, string> = {
    setup: 'bg-yellow-500/20 text-yellow-700',
    active: 'bg-green-500/20 text-green-700',
    completed: 'bg-blue-500/20 text-blue-700',
    archived: 'bg-gray-500/20 text-gray-600',
  };

  if (loading) return <p className="text-muted-foreground mt-10">Loading...</p>;
  if (error) return <p className="text-red-400 mt-10">{error}</p>;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
          <span>/</span>
          <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
          <span>/</span>
          <span>Seasons</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Season Management</h1>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark"
          >
            New Season
          </button>
        </div>
      </div>

      {currentSeason && (
        <div className="mb-6 p-4 border border-primary/30 rounded-lg bg-primary/5">
          <h2 className="text-lg font-semibold mb-2">Current Season</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{currentSeason.name}</p>
              <p className="text-sm text-muted-foreground">
                Status: <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[currentSeason.status] || 'bg-muted'}`}>
                  {currentSeason.status}
                </span>
              </p>
            </div>
            {currentSeason.status === 'active' && (
              <button
                onClick={() => handleComplete(currentSeason.id)}
                className="px-3 py-1.5 border border-red-500 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/10"
              >
                Complete Season
              </button>
            )}
          </div>
        </div>
      )}

      {showNewForm && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">Start New Season</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Season name (optional)"
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(''); }}
              className="px-4 py-2 border border-border rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {seasons.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No seasons yet. Create your first season to get started.</p>
        )}
        {seasons.map((season) => (
          <div key={season.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:border-primary/30 transition-colors">
            <div>
              <p className="font-medium">{season.name}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[season.status] || 'bg-muted'}`}>
                  {season.status}
                </span>
                <span>Created {new Date(season.created_at).toLocaleDateString()}</span>
                {season.completed_at && <span>Completed {new Date(season.completed_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/leagues/${slug}/competitions?season_id=${season.id}`}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:border-primary/50"
              >
                Competitions
              </Link>
              <Link
                href={`/leagues/${slug}/divisions?season_id=${season.id}`}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:border-primary/50"
              >
                Divisions
              </Link>
              <Link
                href={`/leagues/${slug}/history?season_id=${season.id}`}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:border-primary/50"
              >
                History
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
