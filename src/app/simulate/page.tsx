'use client';

import { useEffect, useState } from 'react';
import {
  MatchScoreHeader,
  MatchEventsList,
  LineupTable,
  StatsTable,
} from '@/components/match-report';
import type { MatchEventDisplay, PlayerStats } from '@/components/match-report';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

export default function SimulatePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeId, setHomeId] = useState<string>('');
  const [awayId, setAwayId] = useState<string>('');
  const [homeFormation, setHomeFormation] = useState('442N');
  const [awayFormation, setAwayFormation] = useState('442N');
  const [seed, setSeed] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<{
    home_score: number;
    away_score: number;
    events: MatchEventDisplay[];
    commentary: string;
    penalties?: { home_score: number; away_score: number; rounds: Array<{ home_scored: boolean; away_scored: boolean; home_taker: string; away_taker: string }> };
    home_tactic: string;
    away_tactic: string;
    home_starting: Array<{ position: string; name: string }>;
    away_starting: Array<{ position: string; name: string }>;
    home_stats?: PlayerStats[];
    away_stats?: PlayerStats[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then(data => {
      setTeams(data);
      setLoading(false);
    });
  }, []);

  const simulate = async () => {
    if (!homeId || !awayId) return;
    setSimulating(true);
    setResult(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home_team_id: parseInt(homeId),
          away_team_id: parseInt(awayId),
          home_formation: homeFormation,
          away_formation: awayFormation,
          seed: seed ? parseInt(seed) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        alert(data.error || 'Simulation failed');
      }
    } catch {
      alert('Simulation failed');
    }
    setSimulating(false);
  };

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
        <h1 className="text-3xl font-bold tracking-tight">Simulate Match</h1>
        <p className="text-muted-foreground mt-1">Quick simulate a match between two teams</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Home Team</label>
            <select
              value={homeId}
              onChange={e => setHomeId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="">Select home team...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="mt-3">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Formation</label>
              <input
                type="text"
                value={homeFormation}
                onChange={e => setHomeFormation(e.target.value.toUpperCase())}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                maxLength={5}
                placeholder="442N"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Away Team</label>
            <select
              value={awayId}
              onChange={e => setAwayId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="">Select away team...</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="mt-3">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Formation</label>
              <input
                type="text"
                value={awayFormation}
                onChange={e => setAwayFormation(e.target.value.toUpperCase())}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                maxLength={5}
                placeholder="442N"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-4 pt-4 border-t border-border">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Seed (optional)</label>
            <input
              type="text"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="Random"
            />
          </div>
          <button
            onClick={simulate}
            disabled={simulating || !homeId || !awayId}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            {simulating ? 'Simulating...' : 'Simulate Match'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-6">
          <MatchScoreHeader
            homeName={teams.find(t => t.id === parseInt(homeId))?.name || 'Home'}
            awayName={teams.find(t => t.id === parseInt(awayId))?.name || 'Away'}
            homeScore={result.home_score}
            awayScore={result.away_score}
            homeTactic={result.home_tactic}
            awayTactic={result.away_tactic}
            penalties={result.penalties}
          />

          <MatchEventsList events={result.events} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LineupTable title={`Home Lineup (${result.home_tactic})`} players={result.home_starting} />
            <LineupTable title={`Away Lineup (${result.away_tactic})`} players={result.away_starting} />
          </div>

          {result.home_stats && result.away_stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatsTable title="Home Stats" players={result.home_stats} />
              <StatsTable title="Away Stats" players={result.away_stats} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
