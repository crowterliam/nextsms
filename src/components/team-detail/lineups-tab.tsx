'use client';

import { useState } from 'react';
import { TACTIC_NAMES, FORMATIONS, POSITIONS } from './constants';
import type { SavedLineup, Player } from './types';

interface LineupsTabProps {
  lineups: SavedLineup[];
  players: Player[];
  canManage: boolean;
  onGenerate: (formation: string, tacticCode: string, name: string, aggression: number) => void;
  onActivate: (lineupId: number) => void;
  onDelete: (lineupId: number) => void;
  onUpdateLineup: (lineupId: number, updates: Record<string, unknown>) => void;
}

interface LineupEntry {
  position: string;
  name: string;
  player_id: number;
  is_sub: boolean;
  sub_order: number;
}

export function LineupsTab({ lineups, players, canManage, onGenerate, onActivate, onDelete, onUpdateLineup }: LineupsTabProps) {
  const [showGen, setShowGen] = useState(false);
  const [genFormation, setGenFormation] = useState('442');
  const [genTactic, setGenTactic] = useState('N');
  const [genName, setGenName] = useState('');
  const [genAggression, setGenAggression] = useState(50);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleGenerate = () => {
    onGenerate(genFormation, genTactic, genName || `${genFormation}${genTactic}`, genAggression);
    setShowGen(false);
    setGenName('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Saved Lineups</h2>
        {canManage && (
          <button onClick={() => setShowGen(!showGen)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            {showGen ? 'Cancel' : 'Generate Lineup'}
          </button>
        )}
      </div>

      {canManage && showGen && (
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
              <label className="block text-sm font-medium text-muted-foreground mb-1">Aggression ({genAggression})</label>
              <input type="range" min={0} max={100} value={genAggression} onChange={e => setGenAggression(parseInt(e.target.value))} className="w-32" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
              <input type="text" value={genName} onChange={e => setGenName(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm w-40"
                placeholder={`${genFormation}${genTactic}`} />
            </div>
            <button onClick={handleGenerate}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              Generate &amp; Activate
            </button>
          </div>
        </div>
      )}

      {lineups.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No saved lineups. Generate one to get started.</p>
      ) : (
        <div className="space-y-4">
          {lineups.map(lu => (
            editingId === lu.id ? (
              <LineupEditor
                key={lu.id}
                lineup={lu}
                players={players}
                onSave={(updates) => { onUpdateLineup(lu.id, updates); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <LineupCard
                key={lu.id}
                lineup={lu}
                canManage={canManage}
                onActivate={() => onActivate(lu.id)}
                onDelete={() => onDelete(lu.id)}
                onEdit={() => setEditingId(lu.id)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function LineupCard({ lineup, canManage, onActivate, onDelete, onEdit }: {
  lineup: SavedLineup;
  canManage: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  let lineupData: LineupEntry[] = [];
  try { lineupData = JSON.parse(lineup.lineup || '[]'); } catch {}
  const starting = lineupData.filter(p => !p.is_sub);
  const subs = lineupData.filter(p => p.is_sub);

  return (
    <div className={`border rounded-lg bg-card p-4 ${lineup.is_active ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{lineup.name}</h3>
          <p className="text-xs text-muted-foreground">
            {lineup.formation} / {TACTIC_NAMES[lineup.tactic_code] || lineup.tactic_code} / Aggression: {lineup.aggression ?? 50}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && lineup.is_active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Active</span>
          )}
          {canManage && !lineup.is_active && (
            <button onClick={onActivate}
              className="text-xs px-3 py-1 border border-primary text-primary rounded-lg hover:bg-primary/10">
              Activate
            </button>
          )}
          {canManage && (
            <button onClick={onEdit}
              className="text-xs px-3 py-1 border border-border rounded-lg hover:bg-muted/30">Edit</button>
          )}
          {canManage && (
            <button onClick={onDelete}
              className="text-xs text-destructive hover:text-destructive-dark">Delete</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8">
        <div className="space-y-1">
          {starting.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="font-mono text-xs text-muted-foreground">{p.position}</span>
              <span className="font-medium">{p.name}</span>
            </div>
          ))}
        </div>
        {subs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Subs</p>
            {subs.map((p, i) => (
              <div key={i} className="flex justify-between text-sm text-muted-foreground">
                <span className="font-mono text-xs">{p.position}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LineupEditor({ lineup, players, onSave, onCancel }: {
  lineup: SavedLineup;
  players: Player[];
  onSave: (updates: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  let initialEntries: LineupEntry[] = [];
  try { initialEntries = JSON.parse(lineup.lineup || '[]'); } catch {}

  const [formation, setFormation] = useState(lineup.formation);
  const [tacticCode, setTacticCode] = useState(lineup.tactic_code);
  const [aggression, setAggression] = useState(lineup.aggression ?? 50);
  const [entries, setEntries] = useState<LineupEntry[]>(initialEntries);

  const availablePlayers = players.filter(p => p.injury === 0 && p.suspension === 0);
  const usedIds = new Set(entries.map(e => e.player_id));

  const getFormationPositions = (f: string): string[] => {
    const parsed = parseFormationPositions(f);
    return parsed;
  };

  const handleFormationChange = (newFormation: string) => {
    setFormation(newFormation);
    const positions = getFormationPositions(newFormation);
    const currentStarters = entries.filter(e => !e.is_sub);
    const subs = entries.filter(e => e.is_sub);

    const newStarters: LineupEntry[] = positions.map((pos, idx) => {
      const existing = currentStarters[idx];
      if (existing) return { ...existing, position: pos };
      const available = availablePlayers.filter(p => !usedIds.has(p.id) || entries.some(e => e.player_id === p.id && e === existing));
      return { position: pos, name: '', player_id: 0, is_sub: false, sub_order: 0 };
    });

    setEntries([...newStarters, ...subs]);
  };

  const updateEntry = (index: number, playerId: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const newEntries = [...entries];
    const oldPlayerId = newEntries[index].player_id;
    newEntries[index] = { ...newEntries[index], player_id: playerId, name: player.name };
    if (oldPlayerId && oldPlayerId !== playerId) {
      for (let i = 0; i < newEntries.length; i++) {
        if (i !== index && newEntries[i].player_id === playerId) {
          newEntries[i] = { ...newEntries[i], player_id: oldPlayerId, name: players.find(p => p.id === oldPlayerId)?.name || '' };
        }
      }
    }
    setEntries(newEntries);
  };

  const handleSave = () => {
    const validEntries = entries.filter(e => e.player_id > 0);
    if (validEntries.length < 11) return;
    onSave({
      formation,
      tactic_code: tacticCode,
      aggression,
      lineup: JSON.stringify(validEntries),
    });
  };

  const starters = entries.filter(e => !e.is_sub);
  const subs = entries.filter(e => e.is_sub);

  const getPlayerOptions = (currentIndex: number) => {
    const currentPid = entries[currentIndex]?.player_id;
    return availablePlayers.filter(p => !usedIds.has(p.id) || p.id === currentPid);
  };

  return (
    <div className="border border-primary rounded-lg bg-card p-4">
      <h3 className="font-semibold mb-3">Edit Lineup: {lineup.name}</h3>
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Formation</label>
          <select value={formation} onChange={e => handleFormationChange(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Tactic</label>
          <select value={tacticCode} onChange={e => setTacticCode(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            {Object.entries(TACTIC_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Aggression ({aggression})</label>
          <input type="range" min={0} max={100} value={aggression} onChange={e => setAggression(parseInt(e.target.value))} className="w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Starting XI</h4>
          <div className="space-y-2">
            {starters.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground w-10">{entry.position}</span>
                <select
                  value={entry.player_id || ''}
                  onChange={e => updateEntry(idx, parseInt(e.target.value))}
                  className="flex-1 px-2 py-1.5 bg-background border border-border rounded-lg text-sm"
                >
                  <option value="">Select player...</option>
                  {getPlayerOptions(idx).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.pref_side})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">Substitutes</h4>
          <div className="space-y-2">
            {subs.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground w-10">{entry.position}</span>
                <select
                  value={entry.player_id || ''}
                  onChange={e => updateEntry(starters.length + idx, parseInt(e.target.value))}
                  className="flex-1 px-2 py-1.5 bg-background border border-border rounded-lg text-sm"
                >
                  <option value="">Select player...</option>
                  {getPlayerOptions(starters.length + idx).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.pref_side})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave}
          disabled={entries.filter(e => e.player_id > 0 && !e.is_sub).length < 11}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
          Save Changes
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

function parseFormationPositions(formation: string): string[] {
  const positions: string[] = ['GK'];
  const counts = formation.split('').map(Number);
  const posBases = ['DF', 'MF', 'FW'];
  for (let i = 0; i < counts.length && i < posBases.length; i++) {
    const count = counts[i];
    const base = posBases[i];
    if (count === 1) {
      positions.push(base + 'C');
    } else if (count === 2) {
      positions.push(base + 'L');
      positions.push(base + 'R');
    } else if (count >= 3) {
      positions.push(base + 'L');
      for (let j = 0; j < count - 2; j++) positions.push(base + 'C');
      positions.push(base + 'R');
    }
  }
  return positions;
}
