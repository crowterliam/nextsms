'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/fetch';

interface TeamWithoutManager {
  id: number;
  name: string;
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  status: string;
}

interface LeagueDetail {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  season: number;
  current_week: number;
  status: string;
  teamCount: number;
  userRole: string;
  teamsWithoutManagers: TeamWithoutManager[];
  seasons: Season[];
  currentSeason: Season | null;
  seasonId: number | null;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creatingSeason, setCreatingSeason] = useState(false);

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

  const handleQuickGenerate = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/leagues/${slug}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_placeholder', count: 6 }),
      });
      fetchLeague();
    } catch {}
    setGenerating(false);
  };

  const handleCreateSeason = async () => {
    setCreatingSeason(true);
    try {
      const res = await safeFetch(`/api/leagues/${slug}/seasons`, { method: 'POST' });
      if (res.ok) {
        fetchLeague();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create season');
      }
    } catch {
      alert('Failed to create season');
    }
    setCreatingSeason(false);
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

  const isAdmin = league.userRole === 'owner' || league.userRole === 'admin';
  const hasSeason = league.seasonId !== null;
  const seasonName = league.currentSeason?.name || `Season ${league.season}`;

  const setupChecklist = [
    {
      label: 'Create a season',
      done: hasSeason,
      detail: hasSeason ? `${seasonName} is active` : 'No season created yet',
      action: hasSeason ? null : 'create_season' as const,
    },
    {
      label: 'Add at least 2 teams',
      done: league.teamCount >= 2,
      detail: league.teamCount === 0 ? 'No teams yet' : `${league.teamCount} of 2 minimum`,
      href: `/leagues/${slug}/teams`,
      action: 'Add Teams',
    },
    {
      label: 'Assign managers to teams',
      done: league.teamsWithoutManagers.length === 0 && league.teamCount > 0,
      detail: league.teamsWithoutManagers.length > 0
        ? `${league.teamsWithoutManagers.length} unassigned: ${league.teamsWithoutManagers.slice(0, 3).map(t => t.name).join(', ')}${league.teamsWithoutManagers.length > 3 ? '...' : ''}`
        : league.teamCount > 0 ? 'All teams have managers' : 'No teams yet',
      href: `/leagues/${slug}/members`,
      action: 'Manage Members',
    },
    {
      label: 'Generate fixtures to start the season',
      done: league.status !== 'setup',
      detail: league.status === 'setup' ? 'League is in setup mode' : `${seasonName} is active`,
      href: `/leagues/${slug}/fixtures`,
      action: 'Generate Fixtures',
    },
  ];

  const allDone = setupChecklist.every(c => c.done);
  const incompleteCount = setupChecklist.filter(c => !c.done).length;

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
            {hasSeason && <span>{seasonName}</span>}
            <span className="capitalize px-2 py-1 rounded-full bg-muted text-xs">{league.status}</span>
            {league.current_week > 0 && <span>Week {league.current_week}</span>}
            <span>{league.teamCount} teams</span>
          </div>
        </div>
      </div>

      {!hasSeason && (
        <div className="mb-6 border border-primary/30 rounded-lg bg-primary/5 p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Create Your First Season</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Before you can add teams, generate fixtures, or play matches, you need to create a season.
          </p>
          {isAdmin ? (
            <button
              onClick={handleCreateSeason}
              disabled={creatingSeason}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {creatingSeason ? 'Creating...' : 'Create Season 1'}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">Ask a league admin to create a season.</p>
          )}
        </div>
      )}

      {isAdmin && hasSeason && league.status === 'setup' && (
        <div className="mb-6 border border-primary/30 rounded-lg bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">League Setup Checklist</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {incompleteCount === 0 ? 'Ready to launch' : `${incompleteCount} item${incompleteCount > 1 ? 's' : ''} remaining`}
            </span>
          </div>
          <div className="space-y-3">
            {setupChecklist.map((item) => (
              <div key={item.label} className={`flex items-center justify-between p-3 rounded-lg border ${
                item.done ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.done ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.done ? '\u2713' : '\u2022'}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${item.done ? 'text-green-700' : ''}`}>{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                {!item.done && item.action === 'Add Teams' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleQuickGenerate}
                      disabled={generating}
                      className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {generating ? 'Generating...' : 'Quick Generate 6'}
                    </button>
                    <Link
                      href={item.href!}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors"
                    >
                      Add Manually
                    </Link>
                  </div>
                )}
                {!item.done && item.href && item.action !== 'Add Teams' && (
                  <Link
                    href={item.href}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors"
                  >
                    {item.action}
                  </Link>
                )}
              </div>
            ))}
          </div>
          {allDone && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
              <p className="text-sm font-medium text-green-700 mb-2">All set! Generate fixtures to start the season.</p>
              <Link
                href={`/leagues/${slug}/fixtures`}
                className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark"
              >
                Generate Fixtures
              </Link>
            </div>
          )}
        </div>
      )}

      {isAdmin && league.status === 'active' && league.teamsWithoutManagers.length > 0 && (
        <div className="mb-6 border border-warning/30 rounded-lg bg-warning/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Unassigned teams</p>
            <p className="text-xs text-muted-foreground">
              {league.teamsWithoutManagers.length} team{league.teamsWithoutManagers.length > 1 ? 's' : ''} without a manager: {league.teamsWithoutManagers.slice(0, 3).map(t => t.name).join(', ')}
            </p>
          </div>
          <Link
            href={`/leagues/${slug}/members`}
            className="px-3 py-1.5 border border-warning text-warning rounded-lg text-xs font-medium hover:bg-warning/10"
          >
            Assign Managers
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href={hasSeason ? `/leagues/${slug}/teams` : '#'}
          className={`group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all ${!hasSeason ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Teams</h2>
          <p className="text-sm text-muted-foreground">{league.teamCount} teams in this league</p>
        </Link>

        <Link
          href={hasSeason ? `/leagues/${slug}/table` : '#'}
          className={`group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all ${!hasSeason ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">League Table</h2>
          <p className="text-sm text-muted-foreground">Current standings</p>
        </Link>

        <Link
          href={hasSeason ? `/leagues/${slug}/fixtures` : '#'}
          className={`group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all ${!hasSeason ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Fixtures</h2>
          <p className="text-sm text-muted-foreground">Season schedule & results</p>
        </Link>

        <Link
          href={hasSeason ? `/leagues/${slug}/matches` : '#'}
          className={`group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all ${!hasSeason ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Match History</h2>
          <p className="text-sm text-muted-foreground">All played matches</p>
        </Link>

        <Link
          href={`/leagues/${slug}/seasons`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Seasons</h2>
          <p className="text-sm text-muted-foreground">Manage seasons & progression</p>
        </Link>

        <Link
          href={`/leagues/${slug}/competitions`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Competitions</h2>
          <p className="text-sm text-muted-foreground">Cups, playoffs & tournaments</p>
        </Link>

        <Link
          href={`/leagues/${slug}/divisions`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Divisions</h2>
          <p className="text-sm text-muted-foreground">Multi-tier league structure</p>
        </Link>

        <Link
          href={hasSeason ? `/leagues/${slug}/simulate` : '#'}
          className={`group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all ${!hasSeason ? 'opacity-50 pointer-events-none' : ''}`}
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

        <Link
          href={`/leagues/${slug}/history`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">History</h2>
          <p className="text-sm text-muted-foreground">Past season records</p>
        </Link>

        <Link
          href={`/leagues/${slug}/members`}
          className="group p-5 border border-border rounded-lg bg-card hover:border-primary/50 hover:-translate-y-0.5 transition-all"
        >
          <h2 className="text-lg font-semibold mb-1 group-hover:text-primary">Members</h2>
          <p className="text-sm text-muted-foreground">Invite & manage league members</p>
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
