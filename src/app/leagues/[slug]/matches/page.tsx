'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function LeagueMatchesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [matches, setMatches] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, [slug]);

  const fetchMatches = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/matches`);
      if (res.ok) setMatches(await res.json());
    } catch {}
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Matches</span>
      </div>
      <h1 className="text-2xl font-bold mb-6">Match History</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : matches.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No matches played yet.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <Link
              key={m.id as number}
              href={`/leagues/${slug}/matches/${m.id}`}
              className="flex items-center gap-4 p-3 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors"
            >
              <span className="flex-1 text-right font-medium">{(m.home_team_name as string) || `Team ${m.home_team_id}`}</span>
              <span className="px-3 py-1 bg-muted rounded font-mono font-bold">
                {m.home_score as number} - {m.away_score as number}
              </span>
              <span className="flex-1 font-medium">{(m.away_team_name as string) || `Team ${m.away_team_id}`}</span>
              <span className="text-xs text-muted-foreground">{m.played_at ? new Date(m.played_at as string).toLocaleDateString() : ''}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
