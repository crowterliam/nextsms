'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MatchScoreHeader,
  MatchEventsList,
  LineupTable,
} from '@/components/match-report';
import type { MatchEventDisplay, LineupPlayer } from '@/components/match-report';

function safeParseJson<T>(value: unknown, fallback: T): T {
  try {
    return value ? JSON.parse(value as string) : fallback;
  } catch {
    return fallback;
  }
}

export default function MatchReportPage() {
  const params = useParams();
  const slug = params.slug as string;
  const matchId = params.id as string;
  const [match, setMatch] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMatch();
  }, [slug, matchId]);

  const fetchMatch = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/matches/${matchId}`);
      if (res.ok) {
        setMatch(await res.json());
      } else {
        setError('Match not found');
      }
    } catch {
      setError('Failed to load match');
    }
    setLoading(false);
  };

  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
      <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
      <span>/</span>
      <Link href={`/leagues/${slug}/matches`} className="hover:text-foreground">Matches</Link>
      <span>/</span>
      <span>Report</span>
    </div>
  );

  if (loading) {
    return (
      <div>
        {breadcrumb}
        <p className="text-muted-foreground py-8 text-center">Loading match report...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div>
        {breadcrumb}
        <p className="text-red-500 py-8 text-center">{error || 'Match not found'}</p>
      </div>
    );
  }

  const homeName = (match.home_team_name as string) || 'Home';
  const awayName = (match.away_team_name as string) || 'Away';
  const homeScore = (match.home_score as number) ?? 0;
  const awayScore = (match.away_score as number) ?? 0;

  const rawEvents: Array<Record<string, unknown>> = safeParseJson(match.match_events, []);
  const events: MatchEventDisplay[] = rawEvents.map(ev => ({
    minute: (ev.minute as number) ?? 0,
    type: (ev.type as string) ?? '',
    team: (ev.team as 'home' | 'away') ?? 'home',
    player: (ev.player as string) ?? '',
    secondary_player: ev.secondary as string | undefined,
    commentary: `${ev.player || ''} — ${(ev.type as string) || ''}${ev.secondary ? ` (for ${ev.secondary})` : ''}`,
  }));

  const rawHomeLineup: Array<Record<string, unknown>> = safeParseJson(match.home_lineup, []);
  const rawAwayLineup: Array<Record<string, unknown>> = safeParseJson(match.away_lineup, []);

  const homeLineup: LineupPlayer[] = rawHomeLineup.map(p => ({
    position: (p.position as string) ?? '',
    name: (p.name as string) ?? '',
    is_sub: (p.is_sub as boolean) ?? false,
  }));

  const awayLineup: LineupPlayer[] = rawAwayLineup.map(p => ({
    position: (p.position as string) ?? '',
    name: (p.name as string) ?? '',
    is_sub: (p.is_sub as boolean) ?? false,
  }));

  return (
    <div className="space-y-6">
      {breadcrumb}

      <MatchScoreHeader
        homeName={homeName}
        awayName={awayName}
        homeScore={homeScore}
        awayScore={awayScore}
        homeTactic={(match.home_tactic as string) || undefined}
        awayTactic={(match.away_tactic as string) || undefined}
        status={match.status === 'played' ? undefined : (match.status as string)}
        playedAt={(match.played_at as string) || undefined}
      />

      {events.length > 0 && (
        <MatchEventsList events={events} />
      )}

      {(homeLineup.length > 0 || awayLineup.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LineupTable title={homeName} players={homeLineup} />
          <LineupTable title={awayName} players={awayLineup} />
        </div>
      )}
    </div>
  );
}
