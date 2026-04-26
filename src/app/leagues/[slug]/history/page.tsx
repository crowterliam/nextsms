'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Season {
  id: number;
  season_number: number;
  name: string;
  status: string;
}

interface HistoryEntry {
  id: number;
  season_id: number;
  category: string;
  data: string;
  created_at: string;
}

export default function HistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const filterSeasonId = searchParams.get('season_id');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>(filterSeasonId || '');

  useEffect(() => { fetchHistory(); }, [slug, selectedSeason]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const url = `/api/leagues/${slug}/history${selectedSeason ? `?season_id=${selectedSeason}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSeasons(data.seasons || []);
        setHistory(data.history || []);
      } else setError('Failed to load history');
    } catch { setError('Failed to load history'); }
    setLoading(false);
  };

  const renderStandingsTable = (dataStr: string) => {
    try {
      const entries = JSON.parse(dataStr);
      if (!Array.isArray(entries) || entries.length === 0) return <p className="text-sm text-muted-foreground">No data</p>;
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Team</th>
                <th className="text-center py-2 px-2">P</th>
                <th className="text-center py-2 px-2">W</th>
                <th className="text-center py-2 px-2">D</th>
                <th className="text-center py-2 px-2">L</th>
                <th className="text-center py-2 px-2">GF</th>
                <th className="text-center py-2 px-2">GA</th>
                <th className="text-center py-2 px-2">GD</th>
                <th className="text-center py-2 px-2 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 px-2 font-medium">{String(e.team_name || '')}</td>
                  <td className="py-2 px-2 text-center">{String(e.played || 0)}</td>
                  <td className="py-2 px-2 text-center">{String(e.won || 0)}</td>
                  <td className="py-2 px-2 text-center">{String(e.drawn || 0)}</td>
                  <td className="py-2 px-2 text-center">{String(e.lost || 0)}</td>
                  <td className="py-2 px-2 text-center">{String(e.goals_for || 0)}</td>
                  <td className="py-2 px-2 text-center">{String(e.goals_against || 0)}</td>
                  <td className="py-2 px-2 text-center">{Number(e.goal_difference || 0) > 0 ? '+' : ''}{String(e.goal_difference || 0)}</td>
                  <td className="py-2 px-2 text-center font-bold">{String(e.points || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch { return <p className="text-sm text-red-400">Error parsing data</p>; }
  };

  const renderCompetitionData = (dataStr: string) => {
    try {
      const parsed = JSON.parse(dataStr);
      const comp = parsed.competition as Record<string, unknown> | undefined;
      const fixtures = parsed.fixtures as Array<Record<string, unknown>> | undefined;
      return (
        <div>
          {comp && <p className="text-sm font-medium mb-2">{String(comp.name || 'Unknown Competition')}</p>}
          {fixtures && fixtures.length > 0 && (
            <div className="space-y-1">
              {fixtures.map((f, i) => (
                <div key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span>{String(f.round_name || '')}</span>
                </div>
              ))}
            </div>
          )}
          <details className="mt-2">
            <summary className="text-xs text-primary cursor-pointer">Raw data</summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-40">{dataStr}</pre>
          </details>
        </div>
      );
    } catch { return <p className="text-sm text-red-400">Error parsing data</p>; }
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
          <span>History</span>
        </div>
        <h1 className="text-2xl font-bold">Season History</h1>
      </div>

      <div className="mb-4">
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg bg-background text-sm"
        >
          <option value="">All Seasons</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">No history recorded yet.</p>
          <p className="text-sm text-muted-foreground mt-1">History is saved when seasons are completed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {history.map((entry) => (
            <div key={entry.id} className="border border-border rounded-lg overflow-hidden">
              <div className="p-3 bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{entry.category}</span>
                  <span className="text-sm text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="p-4">
                {entry.category === 'standings' && renderStandingsTable(entry.data)}
                {entry.category === 'competition' && renderCompetitionData(entry.data)}
                {entry.category === 'divisions' && (
                  <details>
                    <summary className="text-sm text-primary cursor-pointer">View division data</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-60">{entry.data}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
