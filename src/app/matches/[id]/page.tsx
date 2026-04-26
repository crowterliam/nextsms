'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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

interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  status: string;
  home_tactic: string;
  away_tactic: string;
  commentary: string;
  match_events: string;
  home_lineup: string;
  away_lineup: string;
  played_at: string;
}

function eventIcon(type: string) {
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

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = parseInt(params.id as string, 10);
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Record<number, Team>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then((data: Team[]) => {
      const map: Record<number, Team> = {};
      for (const t of data) map[t.id] = t;
      setTeams(map);
    });
    fetch(`/api/matches/${matchId}`).then(r => r.json()).then(data => {
      setMatch(data);
      setLoading(false);
    });
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!match) {
    return (
      <div className="text-center py-20 text-muted-foreground">Match not found</div>
    );
  }

  const events: MatchEvent[] = match.match_events ? JSON.parse(match.match_events) : [];
  const homeTeam = teams[match.home_team_id];
  const awayTeam = teams[match.away_team_id];

  return (
    <div>
      <Link
        href="/matches"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Matches
      </Link>

      <div className="rounded-lg border border-border bg-card overflow-hidden mb-6">
        <div className="p-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 bg-primary/10 text-primary">
            {match.status === 'played' ? 'Full Time' : match.status.toUpperCase()}
          </div>
          <div className="flex items-center justify-center gap-6 sm:gap-12">
            <div className="text-right min-w-[120px]">
              <div className="text-xl sm:text-2xl font-bold">{homeTeam?.name || 'Home'}</div>
              <div className="text-sm text-muted-foreground mt-1">{homeTeam?.abbreviation}</div>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                {match.home_tactic}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-4xl sm:text-6xl font-bold tracking-wider">
                <span className="text-primary">{match.home_score}</span>
                <span className="text-muted-foreground mx-2">-</span>
                <span className="text-primary">{match.away_score}</span>
              </div>
            </div>
            <div className="text-left min-w-[120px]">
              <div className="text-xl sm:text-2xl font-bold">{awayTeam?.name || 'Away'}</div>
              <div className="text-sm text-muted-foreground mt-1">{awayTeam?.abbreviation}</div>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                {match.away_tactic}
              </div>
            </div>
          </div>
          {match.played_at && (
            <div className="mt-4 text-xs text-muted-foreground">
              {new Date(match.played_at).toLocaleDateString()} {new Date(match.played_at).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {events.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Match Commentary</h2>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-border/50">
            {events.map((e, i) => (
              <div
                key={i}
                className={`px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                  e.type === 'GOAL' ? 'bg-primary/5' :
                  e.type === 'REDCARD' || e.type === 'SECONDYELLOWCARD' ? 'bg-destructive/5' :
                  e.type === 'YELLOWCARD' ? 'bg-warning/5' :
                  e.type === 'INJURY' ? 'bg-destructive/5' :
                  ''
                }`}
              >
                <span className="text-muted-foreground w-8 text-right shrink-0 text-xs font-mono">{e.minute}&apos;</span>
                {eventIcon(e.type)}
                <span className={`flex-1 ${e.type === 'GOAL' ? 'font-medium' : ''} ${e.team === 'home' ? '' : 'text-right'}`}>
                  {e.commentary}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
