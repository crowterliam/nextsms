'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/fetch';

interface Competition {
  id: number;
  name: string;
  type: string;
  format: string;
  status: string;
  division_id: number | null;
  stages: CompetitionStage[];
}

interface CompetitionStage {
  id: number;
  name: string;
  stage_order: number;
  format: string;
  num_groups: number;
  teams_advancing: number;
  num_legs: number;
  status: string;
}

export default function CompetitionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const seasonId = searchParams.get('season_id');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newComp, setNewComp] = useState({ name: '', type: 'cup', format: 'knockout', division_id: null as number | null });

  useEffect(() => { fetchCompetitions(); }, [slug, seasonId]);

  const fetchCompetitions = async () => {
    setLoading(true);
    try {
      const url = `/api/leagues/${slug}/competitions${seasonId ? `?season_id=${seasonId}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCompetitions(data.competitions || []);
      } else setError('Failed to load competitions');
    } catch { setError('Failed to load competitions'); }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newComp.name.trim()) return;
    setCreating(true);
    try {
      const currentSeasonId = seasonId || (competitions.length > 0 ? competitions[0].id : null);
      if (!currentSeasonId) {
        alert('No active season. Create a season first.');
        setCreating(false);
        return;
      }
      const res = await fetch(`/api/leagues/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newComp.name.trim(),
          type: newComp.type,
          format: newComp.format,
          season_id: parseInt(currentSeasonId as unknown as string) || 1,
          division_id: newComp.division_id,
        }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewComp({ name: '', type: 'cup', format: 'knockout', division_id: null });
        fetchCompetitions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create competition');
      }
    } catch {}
    setCreating(false);
  };

  const handleDelete = async (compId: number) => {
    if (!confirm('Delete this competition and all associated fixtures?')) return;
    try {
      await fetch(`/api/leagues/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', competition_id: compId }),
      });
      fetchCompetitions();
    } catch {}
  };

  const handleAddStage = async (compId: number) => {
    const name = prompt('Stage name (e.g. "Group Stage", "Quarter-Finals"):');
    if (!name) return;
    const format = prompt('Format (round_robin, knockout, group_knockout, two_legged_knockout):', 'knockout');
    if (!format) return;
    const numGroups = format === 'group_knockout' ? parseInt(prompt('Number of groups:', '4') || '4') : 0;
    const teamsAdvancing = parseInt(prompt('Teams advancing to next stage (0 = all):', '2') || '2');

    const comp = competitions.find(c => c.id === compId);
    const nextOrder = (comp?.stages.length || 0) + 1;

    try {
      await fetch(`/api/leagues/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_stage',
          competition_id: compId,
          name, format, stage_order: nextOrder,
          num_groups: numGroups, teams_advancing: teamsAdvancing,
        }),
      });
      fetchCompetitions();
    } catch {}
  };

  const handleGenerateFixtures = async (compId: number) => {
    if (!confirm('Generate fixtures for this competition? Existing unplayed fixtures for this competition will be replaced.')) return;
    try {
      const res = await fetch(`/api/leagues/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_fixtures', competition_id: compId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Generated ${data.fixturesCount} fixtures`);
        fetchCompetitions();
      } else alert(data.error || 'Failed to generate fixtures');
    } catch {}
  };

  const handleAdvanceWeek = async (compId: number) => {
    try {
      const res = await safeFetch(`/api/leagues/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_week', competition_id: compId }),
      });
      const data = await res.json();
      if (res.ok && data.results?.length) {
        const summary = data.results.map((r: Record<string, unknown>) => `${r.home} ${r.home_score}-${r.away_score} ${r.away}`).join('\n');
        alert(`Results:\n${summary}`);
        fetchCompetitions();
      } else alert(data.error || 'No fixtures to play');
    } catch {}
  };

  const typeLabels: Record<string, string> = {
    league: 'League', cup: 'Cup', supercup: 'Super Cup',
    shield: 'Shield', playoff: 'Playoff', friendly: 'Friendly',
  };

  const formatLabels: Record<string, string> = {
    round_robin: 'Round Robin', knockout: 'Knockout',
    group_knockout: 'Group + Knockout', two_legged_knockout: 'Two-Legged KO',
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
          <span>Competitions</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Competitions</h1>
          <button onClick={() => setShowCreateForm(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark">
            Create Competition
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">New Competition</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} placeholder="Competition name" className="px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            <select value={newComp.type} onChange={(e) => setNewComp({ ...newComp, type: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={newComp.format} onChange={(e) => setNewComp({ ...newComp, format: e.target.value })} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
              {Object.entries(formatLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleCreate} disabled={creating || !newComp.name.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {competitions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-3">No competitions yet.</p>
          <p className="text-sm text-muted-foreground">Create cups, leagues, or tournaments to organize matches.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {competitions.map((comp) => (
            <div key={comp.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{comp.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[comp.status] || 'bg-muted'}`}>{comp.status}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>{typeLabels[comp.type] || comp.type}</span>
                    <span>{formatLabels[comp.format] || comp.format}</span>
                    <span>{comp.stages.length} stage{comp.stages.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/leagues/${slug}/competitions/${comp.id}`} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:border-primary/50">View</Link>
                  {comp.status === 'setup' && (
                    <>
                      <button onClick={() => handleAddStage(comp.id)} className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs hover:bg-primary/10">Add Stage</button>
                      <button onClick={() => handleGenerateFixtures(comp.id)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-primary-dark">Generate</button>
                    </>
                  )}
                  {comp.status === 'active' && (
                    <button onClick={() => handleAdvanceWeek(comp.id)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-primary-dark">Play Next</button>
                  )}
                  <button onClick={() => handleDelete(comp.id)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded">Delete</button>
                </div>
              </div>
              {comp.stages.length > 0 && (
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {comp.stages.map((stage) => (
                      <span key={stage.id} className={`px-2 py-1 rounded text-xs border ${stage.status === 'completed' ? 'border-blue-500/30 bg-blue-500/5 text-blue-700' : stage.status === 'active' ? 'border-green-500/30 bg-green-500/5 text-green-700' : 'border-border bg-muted/50'}`}>
                        {stage.name} ({formatLabels[stage.format] || stage.format})
                        {stage.num_groups > 0 && ` - ${stage.num_groups} groups`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
