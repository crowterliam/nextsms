'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Competition { id: number; name: string; type: string; format: string; status: string; }
interface Stage { id: number; name: string; stage_order: number; format: string; status: string; num_groups: number; }
interface Fixture { id: number; home_team_name: string; away_team_name: string; home_team_id: number; away_team_id: number; round_name: string; leg: number; status: string; match_id: number | null; group_name: string | null; bracket_position: number | null; }
interface Standing { team_id: number; team_name: string; abbreviation: string; group_name: string | null; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; goal_difference: number; points: number; }

export default function CompetitionDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const competitionId = params.competitionId as string;
  const [data, setData] = useState<{ competition: Competition; stages: Stage[]; fixtures: Fixture[]; standings: Standing[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'fixtures' | 'standings' | 'bracket'>('fixtures');

  useEffect(() => { fetchData(); }, [slug, competitionId]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/competitions/${competitionId}`);
      if (res.ok) setData(await res.json());
      else setError('Failed to load competition');
    } catch { setError('Failed to load competition'); }
    setLoading(false);
  };

  const handleAdvance = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_week', competition_id: parseInt(competitionId) }),
      });
      if (res.ok) fetchData();
    } catch {}
  };

  if (loading) return <p className="text-muted-foreground mt-10">Loading...</p>;
  if (error || !data) return <p className="text-red-400 mt-10">{error || 'Not found'}</p>;

  const { competition, stages, fixtures, standings } = data;
  const hasGroups = standings.some(s => s.group_name);
  const hasKnockout = stages.some(s => s.format === 'knockout' || s.format === 'two_legged_knockout');

  const groupedFixtures = fixtures.reduce((acc, f) => {
    const key = f.round_name || 'Unknown Round';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {} as Record<string, Fixture[]>);

  const groupedStandings = standings.reduce((acc, s) => {
    const key = s.group_name || 'Table';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {} as Record<string, Standing[]>);

  const statusColors: Record<string, string> = {
    setup: 'bg-yellow-500/20 text-yellow-700',
    active: 'bg-green-500/20 text-green-700',
    completed: 'bg-blue-500/20 text-blue-700',
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
          <span>/</span>
          <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
          <span>/</span>
          <Link href={`/leagues/${slug}/competitions`} className="hover:text-foreground">Competitions</Link>
          <span>/</span>
          <span>{competition.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{competition.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[competition.status] || 'bg-muted'}`}>{competition.status}</span>
          </div>
          {competition.status === 'active' && (
            <button onClick={handleAdvance} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark">
              Play Next Round
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('fixtures')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'fixtures' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>Fixtures</button>
        <button onClick={() => setActiveTab('standings')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'standings' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>Standings</button>
        {hasKnockout && (
          <button onClick={() => setActiveTab('bracket')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'bracket' ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}>Bracket</button>
        )}
      </div>

      {activeTab === 'fixtures' && (
        <div className="space-y-4">
          {Object.entries(groupedFixtures).length === 0 && (
            <p className="text-muted-foreground text-center py-8">No fixtures generated yet.</p>
          )}
          {Object.entries(groupedFixtures).map(([round, fixtures]) => (
            <div key={round}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">{round}</h3>
              <div className="space-y-1">
                {fixtures.map((f) => (
                  <div key={f.id} className={`flex items-center justify-between p-3 rounded-lg border ${f.status === 'played' ? 'border-border bg-card' : 'border-dashed border-border bg-muted/30'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium min-w-[120px] text-right ${f.status === 'played' && f.match_id ? '' : 'text-muted-foreground'}`}>{f.home_team_name}</span>
                      {f.status === 'played' && f.match_id ? (
                        <Link href={`/leagues/${slug}/matches/${f.match_id}`} className="px-3 py-1 bg-muted rounded text-sm font-bold hover:bg-primary/10">
                          {(() => { const m = fixtures.find(x => x.id === f.id); return null; })()}
                          View
                        </Link>
                      ) : (
                        <span className="px-3 py-1 text-xs text-muted-foreground">vs</span>
                      )}
                      <span className={`text-sm font-medium min-w-[120px] ${f.status === 'played' && f.match_id ? '' : 'text-muted-foreground'}`}>{f.away_team_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.leg > 1 && <span className="text-xs text-muted-foreground">Leg {f.leg}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'played' ? 'bg-green-500/20 text-green-700' : 'bg-muted text-muted-foreground'}`}>{f.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="space-y-6">
          {Object.entries(groupedStandings).length === 0 && (
            <p className="text-muted-foreground text-center py-8">No standings yet.</p>
          )}
          {Object.entries(groupedStandings).map(([group, table]) => (
            <div key={group}>
              {hasGroups && <h3 className="font-semibold mb-2">{group}</h3>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Team</th>
                      <th className="text-center py-2 px-2">P</th>
                      <th className="text-center py-2 px-2">W</th>
                      <th className="text-center py-2 px-2">D</th>
                      <th className="text-center py-2 px-2">L</th>
                      <th className="text-center py-2 px-2">GF</th>
                      <th className="text-center py-2 px-2">GA</th>
                      <th className="text-center py-2 px-2">GD</th>
                      <th className="text-center py-2 px-2 font-bold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((s, i) => (
                      <tr key={s.team_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-2 font-medium">{s.team_name}</td>
                        <td className="py-2 px-2 text-center">{s.played}</td>
                        <td className="py-2 px-2 text-center">{s.won}</td>
                        <td className="py-2 px-2 text-center">{s.drawn}</td>
                        <td className="py-2 px-2 text-center">{s.lost}</td>
                        <td className="py-2 px-2 text-center">{s.goals_for}</td>
                        <td className="py-2 px-2 text-center">{s.goals_against}</td>
                        <td className="py-2 px-2 text-center">{s.goal_difference > 0 ? '+' : ''}{s.goal_difference}</td>
                        <td className="py-2 px-2 text-center font-bold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'bracket' && (
        <div className="space-y-4">
          {stages.filter(s => s.format === 'knockout' || s.format === 'two_legged_knockout').map(stage => {
            const stageFixtures = fixtures.filter(f => f.round_name?.includes(stage.name) || true);
            const rounds = [...new Set(stageFixtures.map(f => f.round_name))];
            return (
              <div key={stage.id}>
                <h3 className="font-semibold mb-3">{stage.name}</h3>
                <div className="flex gap-8 overflow-x-auto pb-4">
                  {rounds.map(round => {
                    const roundFixtures = stageFixtures.filter(f => f.round_name === round);
                    return (
                      <div key={round} className="min-w-[200px]">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{round}</p>
                        <div className="space-y-2">
                          {roundFixtures.map(f => (
                            <div key={f.id} className={`p-2 rounded border text-xs ${f.status === 'played' ? 'border-border bg-card' : 'border-dashed border-border'}`}>
                              <div className="font-medium">{f.home_team_name}</div>
                              <div className="font-medium">{f.away_team_name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
