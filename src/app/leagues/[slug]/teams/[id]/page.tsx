'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TeamData {
  id: number;
  name: string;
  abbreviation: string;
  budget: number;
  default_formation: string;
  default_tactic: string;
  default_aggression: number;
  manager_user_id?: string;
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

interface Tactic {
  id: number;
  tactic_code: string;
  formation: string;
  aggression: number;
  is_default: number;
}

interface SavedLineup {
  id: number;
  name: string;
  formation: string;
  tactic_code: string;
  lineup: string;
  conditionals: string;
  is_active: number;
}

const SKILL_COLS = [
  { key: 'st', label: 'ST' },
  { key: 'tk', label: 'TK' },
  { key: 'ps', label: 'PS' },
  { key: 'sh', label: 'SH' },
  { key: 'sm', label: 'SM' },
  { key: 'ag', label: 'AG' },
] as const;

const TACTIC_NAMES: Record<string, string> = {
  N: 'Normal', D: 'Defensive', A: 'Attacking', C: 'Counter-Attack', L: 'Long Ball', P: 'Passing',
};

const FORMATIONS = ['433', '442', '451', '352', '343', '532', '541', '4231', '4141', '4222', '3511', '3412'];

type Tab = 'squad' | 'tactics' | 'lineups' | 'conditionals' | 'transfers';

const POSITIONS = ['GK', 'DFL', 'DFC', 'DFR', 'DML', 'DMC', 'DMR', 'MFL', 'MFC', 'MFR', 'AML', 'AMC', 'AMR', 'FWL', 'FWC', 'FWR'];

const SIGN_OPTIONS = [
  { value: '=', label: '=' },
  { value: '>=', label: '>=' },
  { value: '>', label: '>' },
  { value: '<=', label: '<=' },
  { value: '<', label: '<' },
];

interface CondForm {
  actionType: 'TACTIC' | 'CHANGEPOS' | 'SUB';
  tacticCode: string;
  positionOut: string;
  newPosition: string;
  playerIn: string;
  conditions: Array<{ type: 'MIN' | 'SCORE' | 'YELLOW' | 'RED' | 'INJ'; sign: string; value: string; ref: string }>;
}

export default function TeamDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [lineups, setLineups] = useState<SavedLineup[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('squad');
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [showTacticForm, setShowTacticForm] = useState(false);
  const [newTacticCode, setNewTacticCode] = useState('N');
  const [newFormation, setNewFormation] = useState('442');
  const [newAggression, setNewAggression] = useState(50);

  const [showLineupGen, setShowLineupGen] = useState(false);
  const [genFormation, setGenFormation] = useState('442');
  const [genTactic, setGenTactic] = useState('N');
  const [genName, setGenName] = useState('');

  const [transferPlayerId, setTransferPlayerId] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [editFormation, setEditFormation] = useState('');
  const [editTactic, setEditTactic] = useState('');
  const [editAggression, setEditAggression] = useState(50);

  const [condLineupId, setCondLineupId] = useState<number | null>(null);
  const [condEditing, setCondEditing] = useState(false);
  const [condForm, setCondForm] = useState<CondForm>({
    actionType: 'TACTIC', tacticCode: 'A', positionOut: 'MFC', newPosition: 'MFC', playerIn: '',
    conditions: [{ type: 'MIN', sign: '>=', value: '60', ref: '' }],
  });

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data.team);
        setPlayers(data.players || []);
        setTactics(data.tactics || []);
        setLineups(data.lineups || []);
        setCanManage(data.canManage ?? false);
        setUserRole(data.userRole ?? null);
        setEditFormation(data.team.default_formation || '442');
        setEditTactic(data.team.default_tactic || 'N');
        setEditAggression(data.team.default_aggression || 50);
      }
    } catch {}
    setLoading(false);
  }, [slug, teamId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const sortedPlayers = [...players].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const saveTactic = async () => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/tactics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tactic_code: newTacticCode, formation: newFormation, aggression: newAggression, is_default: tactics.length === 0 }),
    });
    setShowTacticForm(false);
    fetchTeam();
  };

  const deleteTactic = async (tacticId: number) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/tactics`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tactic_id: tacticId }),
    });
    fetchTeam();
  };

  const generateLineup = async () => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'auto_generate',
        formation: genFormation,
        tactic_code: genTactic,
        name: genName || `${genFormation}${genTactic}`,
        set_active: true,
      }),
    });
    setShowLineupGen(false);
    setGenName('');
    fetchTeam();
  };

  const activateLineup = async (lineupId: number) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', lineup_id: lineupId }),
    });
    fetchTeam();
  };

  const deleteLineup = async (lineupId: number) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', lineup_id: lineupId }),
    });
    fetchTeam();
  };

  const listPlayerForTransfer = async () => {
    if (!transferPlayerId || !askingPrice) return;
    await fetch(`/api/leagues/${slug}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', player_id: transferPlayerId, team_id: team!.id, asking_price: parseInt(askingPrice) }),
    });
    setTransferPlayerId(null);
    setAskingPrice('');
    fetchTeam();
  };

  const saveSettings = async () => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_formation: editFormation, default_tactic: editTactic, default_aggression: editAggression }),
    });
    setShowSettings(false);
    fetchTeam();
  };

  const buildCondPreview = (form: CondForm): string => {
    let action = '';
    if (form.actionType === 'TACTIC') {
      action = `TACTIC ${form.tacticCode}`;
    } else if (form.actionType === 'CHANGEPOS') {
      action = `CHANGEPOS ${form.positionOut} ${form.newPosition}`;
    } else if (form.actionType === 'SUB') {
      if (!form.playerIn) return '';
      action = `SUB ${form.positionOut} ${form.playerIn} ${form.newPosition}`;
    }

    const condParts: string[] = [];
    for (const c of form.conditions) {
      if (c.type === 'MIN' || c.type === 'SCORE') {
        if (!c.value) return '';
        condParts.push(`${c.type} ${c.sign} ${c.value}`);
      } else {
        if (!c.ref) return '';
        condParts.push(`${c.type} ${c.ref}`);
      }
    }

    if (condParts.length === 0) return '';
    return `${action} IF ${condParts.join(', ')}`;
  };

  const formatConditional = (c: Record<string, unknown>): string => {
    const action = c.action as Record<string, string>;
    let actionStr = '';
    if (action.type === 'TACTIC') {
      actionStr = `TACTIC ${action.tactic}`;
    } else if (action.type === 'CHANGEPOS') {
      actionStr = `CHANGEPOS ${action.position} ${action.player_ref}`;
    } else if (action.type === 'SUB') {
      actionStr = `SUB ${action.position} ${action.player_ref} ${action.player_ref2}`;
    }

    const conditions = c.conditions as Array<Record<string, string | number>>;
    const condStr = conditions.map(cond => {
      if (cond.type === 'MIN' || cond.type === 'SCORE') {
        return `${cond.type} ${cond.sign} ${cond.value}`;
      }
      return `${cond.type} ${cond.position || cond.player_ref}`;
    }).join(', ');

    return `${actionStr} IF ${condStr}`;
  };

  const addConditional = async (lineup: SavedLineup) => {
    const preview = buildCondPreview(condForm);
    if (!preview) return;

    const existing = JSON.parse(lineup.conditionals || '[]');
    existing.push({ raw: preview, text: preview });
    const newConditionals = existing.map((c: { raw?: string; text?: string; parsed?: string }) => {
      if (c.raw) return { raw: c.raw };
      return c;
    });

    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_conditionals', lineup_id: lineup.id, conditionals: JSON.stringify(newConditionals) }),
    });

    setCondEditing(false);
    setCondForm({
      actionType: 'TACTIC', tacticCode: 'A', positionOut: 'MFC', newPosition: 'MFC', playerIn: '',
      conditions: [{ type: 'MIN', sign: '>=', value: '60', ref: '' }],
    });
    fetchTeam();
  };

  const removeConditional = async (lineup: SavedLineup, index: number) => {
    const existing = JSON.parse(lineup.conditionals || '[]');
    const cleaned = existing.filter((_: unknown, i: number) => i !== index);
    const newConditionals = cleaned.map((c: { raw?: string }) => c.raw ? { raw: c.raw } : c);

    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_conditionals', lineup_id: lineup.id, conditionals: JSON.stringify(newConditionals) }),
    });

    fetchTeam();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center mt-20">
        <p className="text-muted-foreground mb-4">Team not found</p>
        <Link href={`/leagues/${slug}/teams`} className="text-primary hover:underline">Back to Teams</Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'squad', label: 'Squad' },
    { key: 'tactics', label: 'Tactics' },
    { key: 'lineups', label: 'Lineups' },
    { key: 'conditionals', label: 'Conditionals' },
    { key: 'transfers', label: 'Transfers' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
        <span>/</span>
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <Link href={`/leagues/${slug}/teams`} className="hover:text-foreground">Teams</Link>
        <span>/</span>
        <span>{team.name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="font-mono bg-muted px-2 py-0.5 rounded">{team.abbreviation}</span>
            <span>{players.length} players</span>
            <span>Budget: {(team.budget || 0).toLocaleString()}</span>
            <span>Default: {team.default_formation}{team.default_tactic}</span>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-card transition-colors"
          >
            Settings
          </button>
        )}
      </div>

      {canManage && showSettings && (
        <div className="mb-6 p-5 border border-border rounded-lg bg-card">
          <h3 className="font-semibold mb-3">Team Settings</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Default Formation</label>
              <select value={editFormation} onChange={e => setEditFormation(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Default Tactic</label>
              <select value={editTactic} onChange={e => setEditTactic(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                {Object.entries(TACTIC_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Aggression ({editAggression})</label>
              <input type="range" min={0} max={100} value={editAggression} onChange={e => setEditAggression(parseInt(e.target.value))}
                className="w-32" />
            </div>
            <button onClick={saveSettings} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'squad' && (
        <div>
          {canManage && transferPlayerId && (
            <div className="mb-4 p-4 border border-primary/30 rounded-lg bg-primary/5 flex items-end gap-3">
              <span className="text-sm">List <strong>{players.find(p => p.id === transferPlayerId)?.name}</strong> for:</span>
              <input type="number" value={askingPrice} onChange={e => setAskingPrice(e.target.value)}
                className="w-32 px-3 py-1.5 bg-background border border-border rounded-lg text-sm" placeholder="Price" min={0} />
              <button onClick={listPlayerForTransfer}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">List</button>
              <button onClick={() => { setTransferPlayerId(null); setAskingPrice(''); }}
                className="px-4 py-1.5 border border-border rounded-lg text-sm">Cancel</button>
            </div>
          )}
          {players.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No players in squad.</p>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('name')}>Name</th>
                      <th className="px-2 py-2.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('age')}>Age</th>
                      <th className="px-2 py-2.5 text-center font-medium">Nat</th>
                      <th className="px-2 py-2.5 text-center font-medium">Side</th>
                      {SKILL_COLS.map(col => (
                        <th key={col.key} className="px-2 py-2.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort(col.key)}>
                          {col.label}
                        </th>
                      ))}
                      <th className="px-2 py-2.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('fitness')}>Fit</th>
                      <th className="px-2 py-2.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('goals')}>Gls</th>
                      <th className="px-2 py-2.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('assists')}>Ast</th>
                      <th className="px-2 py-2.5 text-center font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('games')}>Gam</th>
                        <th className="px-2 py-2.5 text-center font-medium">Status</th>
                        {canManage && (
                          <th className="px-2 py-2.5 text-center font-medium">Action</th>
                        )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map(p => (
                      <tr key={p.id} className={`border-b border-border/50 transition-colors ${
                        p.injury > 0 ? 'bg-destructive/5' : p.suspension > 0 ? 'bg-warning/5' : 'hover:bg-muted/30'
                      }`}>
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{p.age}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{p.nationality}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground text-xs">{p.pref_side}</td>
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
                          }`}>{p.fitness}</span>
                        </td>
                        <td className="px-2 py-2 text-center">{p.goals || <span className="text-muted-foreground/50">-</span>}</td>
                        <td className="px-2 py-2 text-center">{p.assists || <span className="text-muted-foreground/50">-</span>}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">{p.games}</td>
                        <td className="px-2 py-2 text-center">
                          {p.injury > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">INJ {p.injury}</span>
                          ) : p.suspension > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">SUS</span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-2 py-2 text-center">
                            {p.injury === 0 && p.suspension === 0 && (
                              <button
                                onClick={() => { setTransferPlayerId(p.id); setAskingPrice(''); }}
                                className="text-xs text-primary hover:text-primary-dark transition-colors"
                              >
                                Transfer
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tactics' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tactics</h2>
            {canManage && (
              <button onClick={() => setShowTacticForm(!showTacticForm)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                {showTacticForm ? 'Cancel' : 'Add Tactic'}
              </button>
            )}
          </div>

          {canManage && showTacticForm && (
            <div className="mb-4 p-4 border border-border rounded-lg bg-card">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Tactic</label>
                  <select value={newTacticCode} onChange={e => setNewTacticCode(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                    {Object.entries(TACTIC_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Formation</label>
                  <select value={newFormation} onChange={e => setNewFormation(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                    {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Aggression ({newAggression})</label>
                  <input type="range" min={0} max={100} value={newAggression} onChange={e => setNewAggression(parseInt(e.target.value))} className="w-32" />
                </div>
                <button onClick={saveTactic} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save</button>
              </div>
            </div>
          )}

          {tactics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tactics configured. Add one to get started.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tactics.map(t => (
                <div key={t.id} className="border border-border rounded-lg bg-card p-4 relative">
                  {t.is_default ? (
                    <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Default</span>
                  ) : null}
                  <h3 className="font-semibold text-lg">{TACTIC_NAMES[t.tactic_code] || t.tactic_code}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formation: <span className="font-mono font-medium text-foreground">{t.formation}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">Aggression: {t.aggression}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {canManage && (
                      <button onClick={() => { setNewTacticCode(t.tactic_code); setNewFormation(t.formation); setNewAggression(t.aggression); setShowTacticForm(true); }}
                        className="text-xs text-primary hover:text-primary-dark">Edit</button>
                    )}
                    {canManage && !t.is_default && (
                      <button onClick={() => deleteTactic(t.id)} className="text-xs text-destructive hover:text-destructive-dark">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 p-4 border border-border rounded-lg bg-card">
            <h3 className="font-semibold mb-3">Tactic Effectiveness Matrix</h3>
            <p className="text-sm text-muted-foreground mb-3">Some tactics have bonuses against specific opponent tactics:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-primary/5 border border-primary/20">
                <span className="font-medium text-primary">Defensive</span> beats Long Ball
              </div>
              <div className="p-2 rounded bg-primary/5 border border-primary/20">
                <span className="font-medium text-primary">Counter</span> beats Attacking
              </div>
              <div className="p-2 rounded bg-primary/5 border border-primary/20">
                <span className="font-medium text-primary">Counter</span> beats Passing
              </div>
              <div className="p-2 rounded bg-primary/5 border border-primary/20">
                <span className="font-medium text-primary">Long Ball</span> beats Counter
              </div>
              <div className="p-2 rounded bg-primary/5 border border-primary/20">
                <span className="font-medium text-primary">Passing</span> beats Long Ball
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lineups' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Saved Lineups</h2>
            {canManage && (
              <button onClick={() => setShowLineupGen(!showLineupGen)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                {showLineupGen ? 'Cancel' : 'Generate Lineup'}
              </button>
            )}
          </div>

          {canManage && showLineupGen && (
            <div className="mb-4 p-4 border border-border rounded-lg bg-card">
              <h3 className="font-semibold mb-3">Auto-Generate Lineup</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Formation</label>
                  <select value={genFormation} onChange={e => setGenFormation(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                    {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Tactic</label>
                  <select value={genTactic} onChange={e => setGenTactic(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
                    {Object.entries(TACTIC_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
                  <input type="text" value={genName} onChange={e => setGenName(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm w-40"
                    placeholder={`${genFormation}${genTactic}`} />
                </div>
                <button onClick={generateLineup}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  Generate &amp; Activate
                </button>
              </div>
            </div>
          )}

          {lineups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No saved lineups. Generate one to get started.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lineups.map(lu => {
                const lineupData = JSON.parse(lu.lineup) as Array<{ position: string; name: string; player_id: number; is_sub: boolean }>;
                const starting = lineupData.filter(p => !p.is_sub);
                const subs = lineupData.filter(p => p.is_sub);
                return (
                  <div key={lu.id} className={`border rounded-lg bg-card p-4 ${lu.is_active ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{lu.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {lu.formation} / {TACTIC_NAMES[lu.tactic_code] || lu.tactic_code}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && lu.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Active</span>
                        )}
                        {canManage && !lu.is_active && (
                          <button onClick={() => activateLineup(lu.id)}
                            className="text-xs px-3 py-1 border border-primary text-primary rounded-lg hover:bg-primary/10">
                            Activate
                          </button>
                        )}
                        {canManage && (
                          <button onClick={() => deleteLineup(lu.id)}
                            className="text-xs text-destructive hover:text-destructive-dark">Delete</button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {starting.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="font-mono text-xs text-muted-foreground">{p.position}</span>
                          <span className="font-medium">{p.name}</span>
                        </div>
                      ))}
                      {subs.length > 0 && (
                        <>
                          <div className="border-t border-border/50 my-1" />
                          <p className="text-xs text-muted-foreground font-medium">Subs</p>
                          {subs.map((p, i) => (
                            <div key={i} className="flex justify-between text-sm text-muted-foreground">
                              <span className="font-mono text-xs">{p.position}</span>
                              <span>{p.name}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'conditionals' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Conditional Instructions</h2>
          </div>

          {lineups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No saved lineups. Generate a lineup first to add conditionals.</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-1">Select Lineup</label>
                <select
                  value={condLineupId ?? ''}
                  onChange={e => setCondLineupId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm w-full max-w-xs"
                >
                  <option value="">Choose a lineup...</option>
                  {lineups.map(lu => (
                    <option key={lu.id} value={lu.id}>
                      {lu.name} ({lu.formation} / {TACTIC_NAMES[lu.tactic_code] || lu.tactic_code}){lu.is_active ? ' - Active' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {condLineupId && (() => {
                const selectedLineup = lineups.find(l => l.id === condLineupId);
                if (!selectedLineup) return null;
                const existingConds: Array<{ raw: string; parsed: string }> = [];
                try {
                  const parsed = JSON.parse(selectedLineup.conditionals || '[]');
                  if (Array.isArray(parsed)) {
                    for (const c of parsed) {
                      existingConds.push({ raw: JSON.stringify(c), parsed: formatConditional(c) });
                    }
                  }
                } catch {}

                const lineupPlayers = JSON.parse(selectedLineup.lineup || '[]') as Array<{ position: string; name: string; player_id: number; is_sub: boolean }>;
                const subs = lineupPlayers.filter(p => p.is_sub);

                return (
                  <div>
                    <div className="mb-4 p-4 border border-border rounded-lg bg-card">
                      <h3 className="font-semibold text-sm mb-2">How Conditionals Work</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Conditional instructions are tactical orders executed automatically during a match when specific conditions are met.
                        Each instruction has an <strong>action</strong> (what to do) and one or more <strong>conditions</strong> (when to trigger).
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded bg-primary/5 border border-primary/20">
                          <span className="font-medium text-primary">TACTIC</span> — Switch team tactic (e.g. switch to Attacking when losing)
                        </div>
                        <div className="p-2 rounded bg-primary/5 border border-primary/20">
                          <span className="font-medium text-primary">CHANGEPOS</span> — Move a player to a new position
                        </div>
                        <div className="p-2 rounded bg-primary/5 border border-primary/20">
                          <span className="font-medium text-primary">SUB</span> — Substitute a player (max 3 per match)
                        </div>
                      </div>
                    </div>

                    {existingConds.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold mb-2">Current Instructions</h3>
                        <div className="space-y-2">
                          {existingConds.map((cond, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                              <div>
                                <code className="text-xs font-mono text-primary">{cond.parsed}</code>
                              </div>
                              {canManage && (
                                <button
                                  onClick={() => removeConditional(selectedLineup, idx)}
                                  className="text-xs text-destructive hover:text-destructive-dark ml-3"
                                >Remove</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {existingConds.length === 0 && (
                      <p className="text-sm text-muted-foreground mb-4">No conditionals set for this lineup.</p>
                    )}

                    {canManage && (
                      <>
                        <button
                          onClick={() => setCondEditing(!condEditing)}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium mb-4"
                        >
                          {condEditing ? 'Cancel' : 'Add Instruction'}
                        </button>

                        {condEditing && (
                          <div className="p-4 border border-border rounded-lg bg-card mb-4">
                            <h3 className="font-semibold text-sm mb-3">New Conditional Instruction</h3>

                            <div className="mb-4">
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Action Type</label>
                              <div className="flex gap-2">
                                {(['TACTIC', 'CHANGEPOS', 'SUB'] as const).map(t => (
                                  <button
                                    key={t}
                                    onClick={() => setCondForm(f => ({ ...f, actionType: t }))}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                      condForm.actionType === t
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                  >{t}</button>
                                ))}
                              </div>
                            </div>

                            {condForm.actionType === 'TACTIC' && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Switch To Tactic</label>
                                <select
                                  value={condForm.tacticCode}
                                  onChange={e => setCondForm(f => ({ ...f, tacticCode: e.target.value }))}
                                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                                >
                                  {Object.entries(TACTIC_NAMES).map(([code, name]) => (
                                    <option key={code} value={code}>{name} ({code})</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {condForm.actionType === 'CHANGEPOS' && (
                              <div className="flex gap-3 mb-4">
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-1">Player at Position</label>
                                  <select
                                    value={condForm.positionOut}
                                    onChange={e => setCondForm(f => ({ ...f, positionOut: e.target.value }))}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                                  >
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-1">New Position</label>
                                  <select
                                    value={condForm.newPosition}
                                    onChange={e => setCondForm(f => ({ ...f, newPosition: e.target.value }))}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                                  >
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                              </div>
                            )}

                            {condForm.actionType === 'SUB' && (
                              <div className="flex flex-wrap gap-3 mb-4">
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-1">Player Out (position)</label>
                                  <select
                                    value={condForm.positionOut}
                                    onChange={e => setCondForm(f => ({ ...f, positionOut: e.target.value }))}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                                  >
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-1">Player In</label>
                                  {subs.length > 0 ? (
                                    <select
                                      value={condForm.playerIn}
                                      onChange={e => setCondForm(f => ({ ...f, playerIn: e.target.value }))}
                                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                                    >
                                      <option value="">Select sub...</option>
                                      {subs.map(p => (
                                        <option key={p.player_id} value={p.name}>{p.name} ({p.position})</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={condForm.playerIn}
                                      onChange={e => setCondForm(f => ({ ...f, playerIn: e.target.value }))}
                                      placeholder="Player name"
                                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm w-40"
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-muted-foreground mb-1">Position</label>
                                  <select
                                    value={condForm.newPosition}
                                    onChange={e => setCondForm(f => ({ ...f, newPosition: e.target.value }))}
                                    className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                                  >
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                </div>
                              </div>
                            )}

                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-muted-foreground">Conditions</label>
                                <button
                                  onClick={() => setCondForm(f => ({
                                    ...f,
                                    conditions: [...f.conditions, { type: 'MIN', sign: '>=', value: '', ref: '' }],
                                  }))}
                                  className="text-xs text-primary hover:text-primary-dark"
                                >+ Add condition</button>
                              </div>
                              <div className="space-y-2">
                                {condForm.conditions.map((cond, ci) => (
                                  <div key={ci} className="flex items-center gap-2 flex-wrap">
                                    <select
                                      value={cond.type}
                                      onChange={e => {
                                        const newType = e.target.value as CondForm['conditions'][0]['type'];
                                        setCondForm(f => {
                                          const updated = [...f.conditions];
                                          updated[ci] = { ...updated[ci], type: newType };
                                          return { ...f, conditions: updated };
                                        });
                                      }}
                                      className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs"
                                    >
                                      <option value="MIN">MIN</option>
                                      <option value="SCORE">SCORE</option>
                                      <option value="YELLOW">YELLOW</option>
                                      <option value="RED">RED</option>
                                      <option value="INJ">INJ</option>
                                    </select>

                                    {(cond.type === 'MIN' || cond.type === 'SCORE') ? (
                                      <>
                                        <select
                                          value={cond.sign}
                                          onChange={e => {
                                            setCondForm(f => {
                                              const updated = [...f.conditions];
                                              updated[ci] = { ...updated[ci], sign: e.target.value };
                                              return { ...f, conditions: updated };
                                            });
                                          }}
                                          className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs"
                                        >
                                          {SIGN_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                        <input
                                          type="number"
                                          value={cond.value}
                                          onChange={e => {
                                            setCondForm(f => {
                                              const updated = [...f.conditions];
                                              updated[ci] = { ...updated[ci], value: e.target.value };
                                              return { ...f, conditions: updated };
                                            });
                                          }}
                                          className="w-16 px-2 py-1.5 bg-background border border-border rounded-lg text-xs"
                                          placeholder={cond.type === 'MIN' ? '60' : '0'}
                                        />
                                      </>
                                    ) : (
                                      <select
                                        value={cond.ref}
                                        onChange={e => {
                                          setCondForm(f => {
                                            const updated = [...f.conditions];
                                            updated[ci] = { ...updated[ci], ref: e.target.value };
                                            return { ...f, conditions: updated };
                                          });
                                        }}
                                        className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs"
                                      >
                                        <option value="">Any player</option>
                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                        {lineupPlayers.map(p => (
                                          <option key={p.player_id} value={p.name}>{p.name}</option>
                                        ))}
                                      </select>
                                    )}

                                    {condForm.conditions.length > 1 && (
                                      <button
                                        onClick={() => setCondForm(f => ({
                                          ...f,
                                          conditions: f.conditions.filter((_, i) => i !== ci),
                                        }))}
                                        className="text-xs text-destructive hover:text-destructive-dark"
                                      >Remove</button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {buildCondPreview(condForm) && (
                              <div className="mb-3 p-2 rounded bg-muted/50">
                                <code className="text-xs font-mono">{buildCondPreview(condForm)}</code>
                              </div>
                            )}

                            <button
                              onClick={() => addConditional(selectedLineup)}
                              disabled={!buildCondPreview(condForm)}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              Add Instruction
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Transfer Market</h2>
            <Link href={`/leagues/${slug}/transfers`}
              className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10">
              View Full Market
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Go to the <strong>Squad</strong> tab to list players for transfer. Visit the{' '}
            <Link href={`/leagues/${slug}/transfers`} className="text-primary hover:underline">Transfer Market</Link>{' '}
            to browse and bid on available players.
          </p>
        </div>
      )}
    </div>
  );
}
