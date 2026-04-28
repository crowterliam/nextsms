'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/fetch';

export default function LeagueFixturesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leagueStatus, setLeagueStatus] = useState('');
  const [adminAction, setAdminAction] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [hasSeason, setHasSeason] = useState(true);

  useEffect(() => {
    fetchLeagueAndFixtures();
  }, [slug]);

  const fetchLeagueAndFixtures = async () => {
    const [leagueRes, fixturesRes] = await Promise.all([
      fetch(`/api/leagues/${slug}`).catch(() => null),
      fetch(`/api/leagues/${slug}/fixtures`).catch(() => null),
    ]);

    if (leagueRes?.ok) {
      const league = await leagueRes.json();
      setIsAdmin(league.userRole === 'owner' || league.userRole === 'admin');
      setLeagueStatus(league.status);
      setSeasonName(league.currentSeason?.name || `Season ${league.season}`);
      setHasSeason(league.seasonId !== null);
    }

    if (fixturesRes?.ok) {
      setFixtures(await fixturesRes.json());
    }
    setLoading(false);
  };

  const generateFixtures = async () => {
    if (!confirm('This will replace all existing fixtures and reset all results. Continue?')) return;
    setGenerating(true);
    try {
      const res = await safeFetch(`/api/leagues/${slug}/fixtures`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Generated ${data.matches} matches across ${data.rounds} rounds`);
        fetchLeagueAndFixtures();
      } else {
        alert(data.error || 'Failed');
      }
    } catch {
      alert('Failed');
    }
    setGenerating(false);
  };

  const advanceWeek = async () => {
    setAdvancing(true);
    try {
      const res = await safeFetch(`/api/leagues/${slug}/advance`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Week ${data.week}: ${data.results?.length || 0} matches played`);
        fetchLeagueAndFixtures();
      } else {
        alert(data.error || 'Failed');
      }
    } catch {
      alert('Failed');
    }
    setAdvancing(false);
  };

  const handleAdminAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!confirm(`Are you sure you want to ${action.replace(/_/g, ' ')}?`)) return;
    setAdminAction(action);
    try {
      const res = await safeFetch(`/api/leagues/${slug}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchLeagueAndFixtures();
      } else {
        alert(data.error || 'Failed');
      }
    } catch {
      alert('Failed');
    }
    setAdminAction(null);
  };

  if (!hasSeason && !loading) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
          <span>/</span>
          <span>Fixtures</span>
        </div>
        <h1 className="text-2xl font-bold mb-6">Fixtures</h1>
        <div className="text-center py-12 border border-border rounded-lg bg-card">
          <p className="text-muted-foreground mb-4">No season has been created yet.</p>
          <button
            onClick={() => router.push(`/leagues/${slug}`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Go to League Dashboard
          </button>
        </div>
      </div>
    );
  }

  const grouped = fixtures.reduce<Record<number, Array<Record<string, unknown>>>>((acc, f) => {
    const week = f.week as number;
    if (!acc[week]) acc[week] = [];
    acc[week].push(f);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>{seasonName}</span>
        <span>/</span>
        <span>Fixtures</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={generateFixtures}
              disabled={generating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Fixtures'}
            </button>
          )}
          {leagueStatus === 'active' && (
            <button
              onClick={advanceWeek}
              disabled={advancing}
              className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {advancing ? 'Playing...' : 'Play Next Week'}
            </button>
          )}
        </div>
      </div>

      {isAdmin && leagueStatus === 'active' && fixtures.length > 0 && (
        <div className="mb-4 p-4 border border-border rounded-lg bg-card">
          <h3 className="text-sm font-semibold mb-2">Admin Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAdminAction('reset_all')}
              disabled={adminAction === 'reset_all'}
              className="px-3 py-1.5 text-xs border border-destructive text-destructive rounded-lg font-medium hover:bg-destructive/10 disabled:opacity-50"
            >
              Reset All Results
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No fixtures. {isAdmin ? 'Generate fixtures to create a season schedule.' : 'Ask a league admin to generate fixtures.'}
        </p>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([week, matches]) => (
          <div key={week} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Week {week}</h2>
              {isAdmin && leagueStatus === 'active' && matches.some((f) => f.match_id) && (
                <button
                  onClick={() => handleAdminAction('reset_week', { week: Number(week) })}
                  disabled={adminAction === 'reset_week'}
                  className="px-2 py-1 text-xs border border-destructive/50 text-destructive rounded font-medium hover:bg-destructive/10 disabled:opacity-50"
                >
                  Reset Week
                </button>
              )}
            </div>
            <div className="space-y-2">
              {matches.map((f) => (
                <div key={f.id as number} className="flex items-center gap-4 p-3 border border-border rounded-lg bg-card">
                  <span className="flex-1 text-right font-medium">{f.home_team_name as string}</span>
                  {f.match_id ? (
                    <Link
                      href={`/leagues/${slug}/matches/${f.match_id}`}
                      className="px-3 py-1 bg-muted rounded font-mono font-bold hover:bg-muted/80 transition-colors"
                    >
                      {f.home_score ?? '-'} - {f.away_score ?? '-'}
                    </Link>
                  ) : (
                    <span className="px-3 py-1 text-muted-foreground">vs</span>
                  )}
                  <span className="flex-1 font-medium">{f.away_team_name as string}</span>
                  {isAdmin && f.match_id && (
                    <button
                      onClick={() => handleAdminAction('reset_fixture', { fixture_id: f.id })}
                      disabled={adminAction === 'reset_fixture'}
                      className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded disabled:opacity-50"
                      title="Reset this fixture"
                    >
                      Reset
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
