'use client';

import { useEffect, useState } from 'react';

interface LeagueEntry {
  id: number;
  team_id: number;
  team_name: string;
  abbreviation: string;
  season: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export default function LeaguePage() {
  const [table, setTable] = useState<LeagueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/league').then(r => r.json()).then(data => {
      setTable(data);
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
        <h1 className="text-3xl font-bold tracking-tight">League Table</h1>
        <p className="text-muted-foreground mt-1">Season standings and statistics</p>
      </div>

      {table.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center py-20 text-muted-foreground">
          <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <p className="text-sm">No league data yet.</p>
          <p className="text-xs mt-1">Simulate some matches or seed the database first.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  <th className="px-4 py-3 text-left w-10 font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Team</th>
                  <th className="px-4 py-3 text-center font-medium">P</th>
                  <th className="px-4 py-3 text-center font-medium">W</th>
                  <th className="px-4 py-3 text-center font-medium">D</th>
                  <th className="px-4 py-3 text-center font-medium">L</th>
                  <th className="px-4 py-3 text-center font-medium">GF</th>
                  <th className="px-4 py-3 text-center font-medium">GA</th>
                  <th className="px-4 py-3 text-center font-medium">GD</th>
                  <th className="px-4 py-3 text-center font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${
                      idx === 0 ? 'bg-primary/5' :
                      idx === table.length - 1 ? 'bg-destructive/5' :
                      ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        idx === 0 ? 'bg-primary text-primary-foreground' :
                        idx === 1 ? 'bg-primary-light/20 text-primary' :
                        idx === table.length - 1 ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{entry.team_name}</div>
                      <div className="text-xs text-muted-foreground">{entry.abbreviation}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{entry.played}</td>
                    <td className="px-4 py-3 text-center text-primary">{entry.won}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{entry.drawn}</td>
                    <td className="px-4 py-3 text-center text-destructive">{entry.lost}</td>
                    <td className="px-4 py-3 text-center">{entry.goals_for}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{entry.goals_against}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={entry.goal_difference > 0 ? 'text-primary' : entry.goal_difference < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                        {entry.goal_difference > 0 ? '+' : ''}{entry.goal_difference}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-base font-bold">{entry.points}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
