'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
  played_at: string;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<number, Team>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then(r => r.json()),
      fetch('/api/matches').then(r => r.json()),
    ]).then(([teamData, matchData]) => {
      const map: Record<number, Team> = {};
      for (const t of teamData) map[t.id] = t;
      setTeams(map);
      setMatches(matchData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Match History</h1>
        <p className="text-muted-foreground mt-1">{matches.length} matches played</p>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center py-20 text-muted-foreground">
          <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm">No matches played yet.</p>
          <Link href="/simulate" className="text-primary hover:underline text-sm mt-2">
            Simulate a match
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => {
            const home = teams[m.home_team_id];
            const away = teams[m.away_team_id];
            return (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="block rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex-1 text-right">
                    <div className="font-semibold">{home?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{home?.abbreviation}</div>
                  </div>
                  <div className="px-6 flex flex-col items-center">
                    {m.status === 'played' ? (
                      <span className="text-2xl font-bold tracking-wider">{m.home_score} - {m.away_score}</span>
                    ) : (
                      <span className="text-lg text-muted-foreground">vs</span>
                    )}
                    <span className={`text-xs mt-1 px-2 py-0.5 rounded-full font-medium ${
                      m.status === 'played'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{away?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{away?.abbreviation}</div>
                  </div>
                  <svg className="w-5 h-5 text-muted-foreground ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                {m.played_at && (
                  <div className="px-5 pb-3 text-xs text-muted-foreground">
                    {new Date(m.played_at).toLocaleDateString()} {new Date(m.played_at).toLocaleTimeString()}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
