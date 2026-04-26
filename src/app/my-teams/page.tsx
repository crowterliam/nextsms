'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';

interface ManagedTeam {
  id: number;
  name: string;
  abbreviation: string;
  league_id: string;
  league_name: string;
  league_slug: string;
}

interface AdminTeam {
  id: number;
  name: string;
  abbreviation: string;
  league_id: string;
  league_name: string;
  league_slug: string;
  league_role: string;
}

export default function MyTeamsPage() {
  const { data: session } = useSession();
  const [managed, setManaged] = useState<ManagedTeam[]>([]);
  const [administered, setAdministered] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user) fetchTeams();
    else setLoading(false);
  }, [session]);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/my-teams');
      if (res.ok) {
        const data = await res.json();
        setManaged(data.managed || []);
        setAdministered(data.administered || []);
      }
    } catch {}
    setLoading(false);
  };

  if (!session?.user) {
    return (
      <div className="text-center mt-20">
        <h1 className="text-2xl font-bold mb-4">My Teams</h1>
        <p className="text-muted-foreground mb-4">Sign in to view your teams.</p>
        <Link href="/login" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark">
          Sign In
        </Link>
      </div>
    );
  }

  const grouped = administered.reduce<Record<string, AdminTeam[]>>((acc, team) => {
    if (!acc[team.league_slug]) acc[team.league_slug] = [];
    acc[team.league_slug].push(team);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Teams</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : managed.length === 0 && administered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No teams assigned yet</p>
          <p className="text-sm mb-4">Join a league and get assigned as a team manager to see your teams here.</p>
          <Link href="/leagues" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium">
            Browse Leagues
          </Link>
        </div>
      ) : (
        <>
          {managed.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Teams You Manage</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {managed.map(team => (
                  <Link
                    key={`${team.league_slug}-${team.id}`}
                    href={`/leagues/${team.league_slug}/teams/${team.id}`}
                    className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
                  >
                    <p className="text-lg font-semibold group-hover:text-primary">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs mr-2">{team.abbreviation}</span>
                      {team.league_name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {Object.keys(grouped).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">
                Teams in Your Leagues
                <span className="text-sm font-normal text-muted-foreground ml-2">(admin access)</span>
              </h2>
              {Object.entries(grouped).map(([slug, teams]) => (
                <div key={slug} className="mb-4">
                  <Link href={`/leagues/${slug}/teams`} className="text-sm text-muted-foreground hover:text-foreground mb-2 block">
                    {teams[0].league_name} <span className="text-xs">({teams[0].league_role})</span>
                  </Link>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teams.map(team => (
                      <Link
                        key={team.id}
                        href={`/leagues/${slug}/teams/${team.id}`}
                        className="group p-4 border border-border rounded-lg bg-card hover:border-primary/50 transition-colors"
                      >
                        <p className="font-medium group-hover:text-primary">{team.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{team.abbreviation}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
