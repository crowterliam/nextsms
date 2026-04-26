'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Fixture {
  id: number;
  week: number;
  home_team_id: number;
  home_team_name: string;
  away_team_name: string;
  match_id: number | null;
}

interface WeekResult {
  home: string;
  away: string;
  home_score: number;
  away_score: number;
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [weekResult, setWeekResult] = useState<{ week: number; results: WeekResult[] } | null>(null);

  const loadFixtures = () => {
    fetch('/api/fixtures').then(r => r.json()).then(data => {
      setFixtures(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadFixtures();
  }, []);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch('/api/fixtures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: 1 }),
    });
    if (res.ok) {
      loadFixtures();
    }
    setGenerating(false);
  };

  const advanceWeek = async () => {
    if (!confirm('Simulate the next unplayed week? This will update player stats, league table, injuries, suspensions and fitness.')) return;
    setAdvancing(true);
    setWeekResult(null);
    try {
      const res = await fetch('/api/season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_week', season: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        setWeekResult({ week: data.week, results: data.results });
        loadFixtures();
      } else {
        alert(data.error || 'Failed to advance week');
      }
    } catch {
      alert('Failed to advance week');
    }
    setAdvancing(false);
  };

  const grouped = fixtures.reduce<Record<number, Fixture[]>>((acc, f) => {
    if (!acc[f.week]) acc[f.week] = [];
    acc[f.week].push(f);
    return acc;
  }, {});

  const currentWeek = Object.entries(grouped).find(([, matches]) =>
    matches.some(m => !m.match_id)
  )?.[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fixtures</h1>
          <p className="text-muted-foreground mt-1">
            {fixtures.length > 0
              ? `${Object.keys(grouped).length} weeks scheduled`
              : 'Generate a season schedule'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={advanceWeek}
            disabled={advancing || fixtures.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            {advancing ? 'Simulating...' : 'Play Next Week'}
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary-light text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Season'}
          </button>
        </div>
      </div>

      {weekResult && (
        <div className="mb-8 rounded-lg border border-primary/30 bg-primary/5 p-5">
          <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Week {weekResult.week} Results
          </h3>
          <div className="space-y-2">
            {weekResult.results.map((r, i) => (
              <div key={i} className="flex items-center gap-4 text-sm bg-card rounded-lg px-4 py-2">
                <span className="flex-1 text-right font-medium">{r.home}</span>
                <span className="font-bold text-primary text-base px-3">{r.home_score} - {r.away_score}</span>
                <span className="flex-1 font-medium">{r.away}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {fixtures.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center py-20 text-muted-foreground">
          <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No fixtures generated yet.</p>
          <p className="text-xs mt-1">Add teams first, then click Generate.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([week, matches]) => {
            const allPlayed = matches.every(m => m.match_id);
            const isCurrent = week === currentWeek;
            return (
              <div key={week} className={`rounded-lg border bg-card overflow-hidden transition-all ${
                isCurrent ? 'border-primary/50 shadow-md shadow-primary/5' : 'border-border'
              }`}>
                <div className={`px-4 py-2.5 flex items-center justify-between border-b ${
                  allPlayed ? 'bg-muted/50 border-border' :
                  isCurrent ? 'bg-primary/5 border-primary/30' :
                  'bg-muted/30 border-border'
                }`}>
                  <span className="font-semibold text-sm">Week {week}</span>
                  <div className="flex items-center gap-2">
                    {isCurrent && !allPlayed && (
                      <span className="text-xs font-medium bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                    {allPlayed && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Completed
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {matches.map(f => (
                    <div key={f.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                      <div className="flex-1 text-right font-medium text-sm">{f.home_team_name}</div>
                      {f.match_id ? (
                        <Link
                          href={`/matches/${f.match_id}`}
                          className="px-5 font-bold text-primary hover:text-primary-dark transition-colors"
                        >
                          View
                        </Link>
                      ) : (
                        <div className="px-5 text-muted-foreground text-xs uppercase tracking-wider">vs</div>
                      )}
                      <div className="flex-1 font-medium text-sm">{f.away_team_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
