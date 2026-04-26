'use client';

import { useState } from 'react';
import { TACTIC_NAMES } from './constants';
import type { Tactic } from './types';

interface TacticsTabProps {
  tactics: Tactic[];
  canManage: boolean;
  onSave: (tacticCode: string, aggression: number) => void;
  onDelete: (tacticId: number) => void;
}

export function TacticsTab({ tactics, canManage, onSave, onDelete }: TacticsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [tacticCode, setTacticCode] = useState('N');
  const [aggression, setAggression] = useState(50);

  const handleSave = () => {
    onSave(tacticCode, aggression);
    setShowForm(false);
  };

  const handleEdit = (t: Tactic) => {
    setTacticCode(t.tactic_code);
    setAggression(t.aggression);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tactic Presets</h2>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            {showForm ? 'Cancel' : 'Add Preset'}
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Tactic presets store a tactic style and aggression level. Apply them to lineups from the Lineups tab.
      </p>

      {canManage && showForm && (
        <div className="mb-4 p-4 border border-border rounded-lg bg-card">
          <div className="flex flex-wrap gap-4 items-end">
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
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Save</button>
          </div>
        </div>
      )}

      {tactics.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No tactic presets. Add one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tactics.map(t => (
            <div key={t.id} className="border border-border rounded-lg bg-card p-4 relative">
              {t.is_default ? (
                <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Default</span>
              ) : null}
              <h3 className="font-semibold text-lg">{TACTIC_NAMES[t.tactic_code] || t.tactic_code}</h3>
              <p className="text-sm text-muted-foreground">Aggression: {t.aggression}</p>
              <div className="mt-3 flex items-center gap-2">
                {canManage && (
                  <button onClick={() => handleEdit(t)}
                    className="text-xs text-primary hover:text-primary-dark">Edit</button>
                )}
                {canManage && !t.is_default && (
                  <button onClick={() => onDelete(t.id)} className="text-xs text-destructive hover:text-destructive-dark">Delete</button>
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
  );
}
