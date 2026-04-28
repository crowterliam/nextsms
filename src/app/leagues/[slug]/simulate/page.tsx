'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MatchScoreHeader,
  MatchEventsList,
  LineupTable,
  StatsTable,
} from '@/components/match-report';
import type { MatchEventDisplay, PlayerStats, LineupPlayer } from '@/components/match-report';
import { safeFetch } from '@/lib/fetch';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface SimulateResult {
  home_score: number;
  away_score: number;
  events: MatchEventDisplay[];
  home_tactic: string;
  away_tactic: string;
  home_starting: LineupPlayer[];
  away_starting: LineupPlayer[];
  home_stats?: PlayerStats[];
  away_stats?: PlayerStats[];
  penalties?: {
    home_score: number;
    away_score: number;
    rounds: Array<{ home_scored: boolean; away_scored: boolean; home_taker: string; away_taker: string }>;
  };
}

export default function LeagueSimulatePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [result, setResult] = useState<SimulateResult | null>(null);
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
      const res = await safeFetch(`/api/leagues/${slug}/simulate`, {
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
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-4 pt-4 border-t border-border">
          <button
            onClick={handleSimulate}
            disabled={simulating || !homeId || !awayId}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
          >
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
