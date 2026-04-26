'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

export default function LeagueSimulatePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [slug]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/teams`);
      if (res.ok) setTeams(await res.json());
    } catch {}
  };

  const handleSimulate = async () => {
    if (!homeId || !awayId) return alert('Select both teams');
    setSimulating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/leagues/${slug}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_team_id: parseInt(homeId), away_team_id: parseInt(awayId) }),
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        const data = await res.json();
        alert(data.error || 'Simulation failed');
      }
    } catch {
      alert('Simulation failed');
    }
    setSimulating(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Simulate</span>
      </div>
      <h1 className="text-2xl font-bold mb-6">Quick Simulate</h1>

      <div className="p-5 border border-border rounded-lg bg-card mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Home Team</label>
            <select value={homeId} onChange={(e) => setHomeId(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg">
              <option value="">Select team...</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <span className="pb-2 text-muted-foreground font-bold">vs</span>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1 text-muted-foreground">Away Team</label>
            <select value={awayId} onChange={(e) => setAwayId(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg">
              <option value="">Select team...</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button onClick={handleSimulate} disabled={simulating} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
            {simulating ? 'Simulating...' : 'Simulate'}
          </button>
        </div>
      </div>

      {result && (
        <div className="p-5 border border-border rounded-lg bg-card">
          <div className="text-center mb-4">
            <span className="text-3xl font-bold">{result.home_score} - {result.away_score}</span>
          </div>
          {Array.isArray(result.events) && (
            <div className="space-y-2">
              <h3 className="font-semibold">Events</h3>
              {(result.events as Array<Record<string, unknown>>).map((ev, i) => (
                <div key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground">{ev.minute}&apos;</span>
                  <span>{ev.player as string} — {ev.type as string}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
