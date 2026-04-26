'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function LeagueFixturesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [fixtures, setFixtures] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    fetchFixtures();
  }, [slug]);

  const fetchFixtures = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/fixtures`);
      if (res.ok) setFixtures(await res.json());
    } catch {}
    setLoading(false);
  };

  const generateFixtures = async () => {
    if (!confirm('This will replace all existing fixtures. Continue?')) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/fixtures`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Generated ${data.matches} matches across ${data.rounds} rounds`);
        fetchFixtures();
      } else {
        alert(data.error || 'Failed');
      }
    } catch {
      alert('Failed');
    }
    setGenerating(false);
  };

  const advanceWeek = async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/leagues/${slug}/advance`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Week ${data.week}: ${data.results?.length || 0} matches played`);
        fetchFixtures();
      } else {
        alert(data.error || 'Failed');
      }
    } catch {
      alert('Failed');
    }
    setAdvancing(false);
  };

  const grouped = fixtures.reduce<Record<number, Array<Record<string, unknown>>>>((acc, f) => {
    const week = f.week as number;
    if (!acc[week]) acc[week] = [];
    acc[week].push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Fixtures</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <div className="flex gap-2">
          <button
            onClick={generateFixtures}
            disabled={generating}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Fixtures'}
          </button>
          <button
            onClick={advanceWeek}
            disabled={advancing}
            className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {advancing ? 'Playing...' : 'Play Next Week'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No fixtures. Generate fixtures to create a season schedule.</p>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([week, matches]) => (
          <div key={week} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Week {week}</h2>
            <div className="space-y-2">
              {matches.map((f) => (
                <div key={f.id as number} className="flex items-center gap-4 p-3 border border-border rounded-lg bg-card">
                  <span className="flex-1 text-right font-medium">{f.home_team_name as string}</span>
                  {f.match_id ? (
                    <span className="px-3 py-1 bg-muted rounded font-mono font-bold">
                      {f.home_score ?? '-'} - {f.away_score ?? '-'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-muted-foreground">vs</span>
                  )}
                  <span className="flex-1 font-medium">{f.away_team_name as string}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
