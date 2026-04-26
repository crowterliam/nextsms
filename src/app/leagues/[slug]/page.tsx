'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import Link from 'next/link';

interface LeagueDetail {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  season: number;
  current_week: number;
  status: string;
  teamCount: number;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: session } = useSession();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeague();
  }, [slug]);

  const fetchLeague = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}`);
      if (res.ok) {
        setLeague(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to load league');
      }
    } catch {
      setError('Failed to load league');
    }
  };

  if (error) {
    return (
      <div className="text-center mt-20">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/leagues" className="text-primary hover:underline">Back to Leagues</Link>
      </div>
    );
  }

  if (!league) {
    return <p className="text-muted-foreground mt-10">Loading...</p>;
  }

  const isAdmin = session?.user && (league.owner_id === session.user.id);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
          <span>/</span>
          <span>{league.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{league.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Season {league.season}</span>
            <span className="capitalize px-2 py-1 rounded-full bg-muted text-xs">{league.status}</span>
            {league.current_week > 0 && <span>Week {league.current_week}</span>}
            <span>{league.teamCount} teams</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href={`/leagues/${slug}/teams`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Teams</h2>
          <p className="text-sm text-muted-foreground">{league.teamCount} teams in this league</p>
        </Link>

        <Link
          href={`/leagues/${slug}/table`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">League Table</h2>
          <p className="text-sm text-muted-foreground">Current standings</p>
        </Link>

        <Link
          href={`/leagues/${slug}/fixtures`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Fixtures</h2>
          <p className="text-sm text-muted-foreground">Season schedule & results</p>
        </Link>

        <Link
          href={`/leagues/${slug}/matches`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Match History</h2>
          <p className="text-sm text-muted-foreground">All played matches</p>
        </Link>

        <Link
          href={`/leagues/${slug}/simulate`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Simulate</h2>
          <p className="text-sm text-muted-foreground">Quick match simulation</p>
        </Link>

        <Link
          href={`/leagues/${slug}/transfers`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Transfer Market</h2>
          <p className="text-sm text-muted-foreground">Buy, sell, and loan players</p>
        </Link>

        {isAdmin && (
          <Link
            href={`/leagues/${slug}/config`}
            className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
          >
            <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Settings</h2>
            <p className="text-sm text-muted-foreground">League configuration</p>
          </Link>
        )}
      </div>
    </div>
  );
}
