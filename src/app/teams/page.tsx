'use client';

import { useEffect, useState } from 'react';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
}

interface Player {
  id: number;
  name: string;
  age: number;
  nationality: string;
  pref_side: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  sm: number;
  ag: number;
  games: number;
  goals: number;
  assists: number;
  saves: number;
  tackles: number;
  keypasses: number;
  shots: number;
  dp: number;
  injury: number;
  suspension: number;
  fitness: number;
}

const SKILL_COLS = [
  { key: 'st', label: 'ST' },
  { key: 'tk', label: 'TK' },
  { key: 'ps', label: 'PS' },
  { key: 'sh', label: 'SH' },
  { key: 'sm', label: 'SM' },
  { key: 'ag', label: 'AG' },
] as const;

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then(data => {
      setTeams(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetch(`/api/teams/${selectedTeam}`).then(r => r.json()).then(data => {
        setPlayers(data.players || []);
      });
    }
  }, [selectedTeam]);

  const createTeam = async () => {
    if (!newName || !newAbbr) return;
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_roster', name: newName, abbreviation: newAbbr.toUpperCase() }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewName('');
      setNewAbbr('');
      const data = await fetch('/api/teams').then(r => r.json());
      setTeams(data);
    }
  };

  const deleteTeam = async (id: number) => {
    if (!confirm('Delete this team and all its players?')) return;
    await fetch(`/api/teams/${id}`, { method: 'DELETE' });
    if (selectedTeam === id) { setSelectedTeam(null); setPlayers([]); }
    setTeams(teams.filter(t => t.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedTeamData = teams.find(t => t.id === selectedTeam);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">{teams.length} teams in the league</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showCreate
              ? 'bg-muted text-muted-foreground hover:bg-border'
              : 'bg-primary text-primary-foreground hover:bg-primary-dark'
          }`}
        >
          {showCreate ? 'Cancel' : '+ New Team'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Create New Team</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Team Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="e.g. Manchester City"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Abbreviation</label>
              <input
                type="text"
                value={newAbbr}
                onChange={e => setNewAbbr(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="MCI"
                maxLength={5}
              />
            </div>
            <button
              onClick={createTeam}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark text-sm font-medium transition-colors"
            >
              Create & Generate Roster
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Team List</h2>
            </div>
            {teams.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No teams yet. Create one or seed the database.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {teams.map(team => (
                  <div
                    key={team.id}
                    className={`px-4 py-3 cursor-pointer flex justify-between items-center transition-colors ${
                      selectedTeam === team.id
                        ? 'bg-primary/5 border-l-2 border-l-primary'
                        : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                    }`}
                    onClick={() => setSelectedTeam(team.id)}
                  >
                    <div>
                      <div className="font-medium text-sm">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{team.abbreviation}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTeam(team.id); }}
                      className="text-muted-foreground hover:text-destructive text-xs transition-colors p-1 rounded hover:bg-destructive/10"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {selectedTeamData?.name} Roster
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{players.length} players</p>
                </div>
              </div>
              {players.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No players.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="px-3 py-2.5 text-left font-medium">Name</th>
                        <th className="px-2 py-2.5 text-center font-medium">Age</th>
                        <th className="px-2 py-2.5 text-center font-medium">Nat</th>
                        {SKILL_COLS.map(col => (
                          <th key={col.key} className="px-2 py-2.5 text-center font-medium">{col.label}</th>
                        ))}
                        <th className="px-2 py-2.5 text-center font-medium">Fit</th>
                        <th className="px-2 py-2.5 text-center font-medium">Gls</th>
                        <th className="px-2 py-2.5 text-center font-medium">Ast</th>
                        <th className="px-2 py-2.5 text-center font-medium">Gam</th>
                        <th className="px-2 py-2.5 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map(p => (
                        <tr
                          key={p.id}
                          className={`border-b border-border/50 transition-colors ${
                            p.injury > 0 ? 'bg-destructive/5' :
                            p.suspension > 0 ? 'bg-warning/5' :
                            'hover:bg-muted/30'
                          }`}
                        >
                          <td className="px-3 py-2 font-medium">{p.name}</td>
                          <td className="px-2 py-2 text-center text-muted-foreground">{p.age}</td>
                          <td className="px-2 py-2 text-center text-muted-foreground">{p.nationality}</td>
                          {SKILL_COLS.map(col => (
                            <td key={col.key} className="px-2 py-2 text-center">
                              <span className={`${
                                (p as Record<string, number>)[col.key] >= 90 ? 'text-primary font-semibold' :
                                (p as Record<string, number>)[col.key] >= 75 ? 'text-primary-light' :
                                'text-muted-foreground'
                              }`}>
                                {(p as Record<string, number>)[col.key]}
                              </span>
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-8 rounded text-xs font-medium ${
                              p.fitness >= 90 ? 'bg-primary/10 text-primary' :
                              p.fitness >= 70 ? 'bg-warning/10 text-warning' :
                              'bg-destructive/10 text-destructive'
                            }`}>
                              {p.fitness}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">{p.goals || <span className="text-muted-foreground/50">-</span>}</td>
                          <td className="px-2 py-2 text-center">{p.assists || <span className="text-muted-foreground/50">-</span>}</td>
                          <td className="px-2 py-2 text-center text-muted-foreground">{p.games}</td>
                          <td className="px-2 py-2 text-center">
                            {p.injury > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                                INJ {p.injury}
                              </span>
                            ) : p.suspension > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">
                                SUS
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card flex flex-col items-center justify-center py-20 text-muted-foreground">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">Select a team to view its roster</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
