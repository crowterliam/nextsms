'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/fetch';

interface Division {
  id: number;
  name: string;
  level: number;
  promotion_spots: number;
  relegation_spots: number;
  playoff_spots: number;
  teams: Array<{ id: number; team_id: number; team_name: string; abbreviation: string }>;
}

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

export default function DivisionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const seasonId = searchParams.get('season_id');
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDiv, setNewDiv] = useState({ name: '', level: 1, promotion_spots: 0, relegation_spots: 0, playoff_spots: 0 });
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (seasonId) fetchDivisions(); }, [slug, seasonId]);

  const fetchDivisions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/divisions`);
      if (res.ok) {
        const data = await res.json();
        setDivisions(data.divisions || []);
      } else setError('Failed to load divisions');
    } catch { setError('Failed to load divisions'); }
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...newDiv }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewDiv({ name: '', level: divisions.length + 1, promotion_spots: 0, relegation_spots: 0, playoff_spots: 0 });
        fetchDivisions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create division');
      }
    } catch {}
    setCreating(false);
  };

  const handleAutoAssign = async () => {
    if (!confirm('Auto-assign teams to divisions based on league standings?')) return;
    try {
      const res = await fetch(`/api/leagues/${slug}/seasons/${seasonId}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_assign' }),
      });
      if (res.ok) fetchDivisions();
      else {
        const data = await res.json();
        alert(data.error || 'Failed to auto-assign');
      }
    } catch {}
  };

  const handleRemoveTeam = async (divisionId: number, teamId: number) => {
    try {
      await safeFetch(`/api/leagues/${slug}/seasons/${seasonId}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_team', division_id: divisionId, team_id: teamId }),
      });
      fetchDivisions();
    } catch {}
  };

  const handleDeleteDivision = async (divisionId: number) => {
    if (!confirm('Delete this division and remove all team assignments?')) return;
    try {
      await fetch(`/api/leagues/${slug}/seasons/${seasonId}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', division_id: divisionId }),
      });
      fetchDivisions();
    } catch {}
  };

  if (!seasonId) {
    return (
      <div>
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
            <span>/</span>
            <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
            <span>/</span>
            <span>Divisions</span>
          </div>
          <h1 className="text-2xl font-bold">Division Management</h1>
        </div>
        <p className="text-muted-foreground text-center py-8">Select a season from the Seasons page to manage divisions.</p>
      </div>
    );
  }

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
          <span>Divisions</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Division Management</h1>
          <div className="flex gap-2">
            {divisions.length > 0 && (
              <button onClick={handleAutoAssign} className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/10">
                Auto-Assign Teams
              </button>
            )}
            <button onClick={() => setShowCreateForm(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark">
              Add Division
            </button>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">Create Division</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input type="text" value={newDiv.name} onChange={(e) => setNewDiv({ ...newDiv, name: e.target.value })} placeholder="Division name" className="px-3 py-2 border border-border rounded-lg bg-background text-sm col-span-2" />
            <input type="number" value={newDiv.level} onChange={(e) => setNewDiv({ ...newDiv, level: parseInt(e.target.value) || 1 })} placeholder="Level (1=top)" min={1} className="px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            <input type="number" value={newDiv.promotion_spots} onChange={(e) => setNewDiv({ ...newDiv, promotion_spots: parseInt(e.target.value) || 0 })} placeholder="Promotion spots" min={0} className="px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            <input type="number" value={newDiv.relegation_spots} onChange={(e) => setNewDiv({ ...newDiv, relegation_spots: parseInt(e.target.value) || 0 })} placeholder="Relegation spots" min={0} className="px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            <input type="number" value={newDiv.playoff_spots} onChange={(e) => setNewDiv({ ...newDiv, playoff_spots: parseInt(e.target.value) || 0 })} placeholder="Playoff spots" min={0} className="px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleCreate} disabled={creating || !newDiv.name.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {divisions.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-3">No divisions created for this season.</p>
          <p className="text-sm text-muted-foreground">Create divisions to organize teams into tiers (e.g. Premier Division, Division 1).</p>
        </div>
      )}

      <div className="space-y-4">
        {divisions.sort((a, b) => a.level - b.level).map((div) => (
          <div key={div.id} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-muted/30">
              <div>
                <h3 className="font-semibold">{div.name}</h3>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>Level {div.level}</span>
                  {div.promotion_spots > 0 && <span className="text-green-600">{div.promotion_spots} promoted</span>}
                  {div.relegation_spots > 0 && <span className="text-red-600">{div.relegation_spots} relegated</span>}
                  {div.playoff_spots > 0 && <span className="text-blue-600">{div.playoff_spots} playoff</span>}
                </div>
              </div>
              <button onClick={() => handleDeleteDivision(div.id)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded">Delete</button>
            </div>
            <div className="p-4">
              {div.teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {div.teams.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                      {t.team_name}
                      <button onClick={() => handleRemoveTeam(div.id, t.team_id)} className="text-red-400 hover:text-red-600 ml-1">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
