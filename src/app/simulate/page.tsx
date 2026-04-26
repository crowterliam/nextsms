'use client';

import { useEffect, useState } from 'react';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface MatchEvent {
  minute: number;
  type: string;
  team: 'home' | 'away';
  player: string;
  detail?: string;
  secondary_player?: string;
  commentary: string;
}

interface PlayerStats {
  name: string;
  pos: string;
  goals: number;
  assists: number;
  shots: number;
  shots_on: number;
  tackles: number;
  saves: number;
  keypasses: number;
  yellowcards: number;
  redcards: number;
  rating: number;
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'GOAL':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
          G
        </span>
      );
    case 'YELLOWCARD': case 'SECONDYELLOWCARD':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-warning/20">
          <span className="w-3 h-4 bg-warning rounded-sm" />
        </span>
      );
    case 'REDCARD':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/20">
          <span className="w-3 h-4 bg-destructive rounded-sm" />
        </span>
      );
    case 'INJURY':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/20 text-destructive text-xs">
          +
        </span>
      );
    case 'SAVE':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-info/20 text-info text-xs font-bold">
          S
        </span>
      );
    case 'CHANGETACTIC':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs">
          T
        </span>
      );
    case 'SUB':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-info/20 text-info text-xs">
          &#x21C4;
        </span>
      );
    case 'PENALTY':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
          P
        </span>
      );
    case 'COMM_HALFTIME': case 'COMM_FULLTIME':
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs">
          &#x25CF;
        </span>
      );
    default:
      return null;
  }
}

function LineupTable({ title, players }: { title: string; players: Array<{ position: string; name: string }> }) {
  if (!players?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {players.map((p, i) => (
          <div key={i} className="px-4 py-2 text-sm flex justify-between items-center hover:bg-muted/20 transition-colors">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{p.position}</span>
            <span className="font-medium">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsTable({ title, players }: { title: string; players: PlayerStats[] }) {
  if (!players?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="px-2 py-2 text-center font-medium">G</th>
              <th className="px-2 py-2 text-center font-medium">A</th>
              <th className="px-2 py-2 text-center font-medium">Sh</th>
              <th className="px-2 py-2 text-center font-medium">Tk</th>
              <th className="px-2 py-2 text-center font-medium">Kp</th>
              <th className="px-2 py-2 text-center font-medium">Sv</th>
              <th className="px-2 py-2 text-center font-medium">C</th>
              <th className="px-2 py-2 text-center font-bold">Rt</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr
                key={i}
                className={`border-b border-border/50 transition-colors ${
                  p.goals > 0 ? 'bg-primary/5' :
                  p.redcards > 0 ? 'bg-destructive/5' :
                  p.yellowcards > 0 ? 'bg-warning/5' :
                  ''
                }`}
              >
                <td className="px-3 py-1.5 font-medium">{p.name}</td>
                <td className="px-2 py-1.5 text-center">{p.goals || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.assists || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.shots || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.tackles || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.keypasses || ''}</td>
                <td className="px-2 py-1.5 text-center">{p.saves || ''}</td>
                <td className="px-2 py-1.5 text-center">
                  {p.yellowcards > 0 && (
                    <span className="inline-block w-2 h-3 bg-warning rounded-sm mr-1 align-middle" />
                  )}
                  {p.redcards > 0 && (
                    <span className="inline-block w-2 h-3 bg-destructive rounded-sm align-middle" />
                  )}
                </td>
                <td className="px-2 py-1.5 text-center font-bold">{p.rating || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
    events: MatchEvent[];
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
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 bg-primary/10 text-primary">
                Full Time
              </div>
              <div className="flex items-center justify-center gap-6 sm:gap-12">
                <div className="text-right min-w-[120px]">
                  <div className="text-xl sm:text-2xl font-bold">{teams.find(t => t.id === parseInt(homeId))?.name || 'Home'}</div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                    {result.home_tactic}
                  </div>
                </div>
                <div className="text-4xl sm:text-6xl font-bold tracking-wider">
                  <span className="text-primary">{result.home_score}</span>
                  <span className="text-muted-foreground mx-2">-</span>
                  <span className="text-primary">{result.away_score}</span>
                </div>
                <div className="text-left min-w-[120px]">
                  <div className="text-xl sm:text-2xl font-bold">{teams.find(t => t.id === parseInt(awayId))?.name || 'Away'}</div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                    {result.away_tactic}
                  </div>
                </div>
              </div>

              {result.penalties && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="text-sm font-medium text-muted-foreground mb-3">
                    Penalties: {result.penalties.home_score} - {result.penalties.away_score}
                  </div>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {result.penalties.rounds.map((r, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg px-3 py-2 text-xs min-w-[60px]">
                        <span className={r.home_scored ? 'text-primary font-bold' : 'text-destructive'}>
                          {r.home_taker} {r.home_scored ? '\u2713' : '\u2717'}
                        </span>
                        <span className={r.away_scored ? 'text-primary font-bold' : 'text-destructive'}>
                          {r.away_taker} {r.away_scored ? '\u2713' : '\u2717'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Match Commentary</h2>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
              {result.events?.map((e: MatchEvent, i: number) => (
                <div
                  key={i}
                  className={`px-4 py-2.5 text-sm flex items-center gap-3 ${
                    e.type === 'GOAL' ? 'bg-primary/5' :
                    e.type === 'REDCARD' || e.type === 'SECONDYELLOWCARD' ? 'bg-destructive/5' :
                    e.type === 'YELLOWCARD' ? 'bg-warning/5' :
                    e.type === 'INJURY' ? 'bg-destructive/5' :
                    ''
                  }`}
                >
                  <span className="text-muted-foreground w-8 text-right shrink-0 text-xs font-mono">{e.minute}&apos;</span>
                  <EventIcon type={e.type} />
                  <span className={`flex-1 ${e.type === 'GOAL' ? 'font-medium' : ''}`}>{e.commentary}</span>
                </div>
              ))}
            </div>
          </div>

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
