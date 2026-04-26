'use client';

import { useState } from 'react';
import { TACTIC_NAMES, FORMATIONS } from './constants';

interface TeamSettingsProps {
  defaultFormation: string;
  defaultTactic: string;
  defaultAggression: number;
  onSave: (formation: string, tactic: string, aggression: number) => void;
  onCancel: () => void;
}

export function TeamSettings({ defaultFormation, defaultTactic, defaultAggression, onSave, onCancel }: TeamSettingsProps) {
  const [formation, setFormation] = useState(defaultFormation);
  const [tactic, setTactic] = useState(defaultTactic);
  const [aggression, setAggression] = useState(defaultAggression);

  const handleSave = () => {
    onSave(formation, tactic, aggression);
  };

  return (
    <div className="mb-6 p-5 border border-border rounded-lg bg-card">
      <h3 className="font-semibold mb-3">Team Settings</h3>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Default Formation</label>
          <select value={formation} onChange={e => setFormation(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Default Tactic</label>
          <select value={tactic} onChange={e => setTactic(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            {Object.entries(TACTIC_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Aggression ({aggression})</label>
          <input type="range" min={0} max={100} value={aggression} onChange={e => setAggression(parseInt(e.target.value))}
            className="w-32" />
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
