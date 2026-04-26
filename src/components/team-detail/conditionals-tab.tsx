'use client';

import { useState } from 'react';
import { TACTIC_NAMES, POSITIONS, SIGN_OPTIONS } from './constants';
import type { SavedLineup, CondForm } from './types';

interface ConditionalsTabProps {
  lineups: SavedLineup[];
  canManage: boolean;
  onAdd: (lineup: SavedLineup, rawInstruction: string) => void;
  onRemove: (lineup: SavedLineup, index: number) => void;
}

const DEFAULT_COND_FORM: CondForm = {
  actionType: 'TACTIC', tacticCode: 'A', positionOut: 'MFC', newPosition: 'MFC', playerIn: '',
  conditions: [{ type: 'MIN', sign: '>=', value: '60', ref: '' }],
};

function buildCondPreview(form: CondForm): string {
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
}

function formatConditional(c: Record<string, unknown>): string {
  if (typeof c.raw === 'string') return c.raw;
  if (typeof c === 'string') return c;

  const action = c.action as Record<string, string> | undefined;
  if (!action) return JSON.stringify(c);

  let actionStr = '';
  if (action.type === 'TACTIC') {
    actionStr = `TACTIC ${action.tactic}`;
  } else if (action.type === 'CHANGEPOS') {
    actionStr = `CHANGEPOS ${action.position} ${action.player_ref}`;
  } else if (action.type === 'SUB') {
    actionStr = `SUB ${action.position} ${action.player_ref} ${action.player_ref2}`;
  }

  const conditions = c.conditions as Array<Record<string, string | number>> | undefined;
  if (!conditions) return JSON.stringify(c);

  const condStr = conditions.map(cond => {
    if (cond.type === 'MIN' || cond.type === 'SCORE') {
      return `${cond.type} ${cond.sign} ${cond.value}`;
    }
    return `${cond.type} ${cond.position || cond.player_ref}`;
  }).join(', ');

  return `${actionStr} IF ${condStr}`;
}

export function ConditionalsTab({ lineups, canManage, onAdd, onRemove }: ConditionalsTabProps) {
  const [condLineupId, setCondLineupId] = useState<number | null>(null);
  const [condEditing, setCondEditing] = useState(false);
  const [condForm, setCondForm] = useState<CondForm>({ ...DEFAULT_COND_FORM });

  const selectedLineup = lineups.find(l => l.id === condLineupId);
  const existingConds: Array<{ raw: string; parsed: string }> = [];
  let lineupPlayers: Array<{ position: string; name: string; player_id: number; is_sub: boolean }> = [];
  let subs: Array<{ position: string; name: string; player_id: number; is_sub: boolean }> = [];

  if (selectedLineup) {
    try {
      const parsed = JSON.parse(selectedLineup.conditionals || '[]');
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          const text = typeof c === 'string' ? c : formatConditional(c as Record<string, unknown>);
          if (text) existingConds.push({ raw: text, parsed: text });
        }
      }
    } catch {}
    lineupPlayers = JSON.parse(selectedLineup.lineup || '[]') as typeof lineupPlayers;
    subs = lineupPlayers.filter(p => p.is_sub);
  }

  const handleAdd = () => {
    if (!selectedLineup) return;
    const preview = buildCondPreview(condForm);
    if (!preview) return;
    onAdd(selectedLineup, preview);
    setCondEditing(false);
    setCondForm({ ...DEFAULT_COND_FORM });
  };

  return (
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

          {selectedLineup && (
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
                            onClick={() => onRemove(selectedLineup, idx)}
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
                        onClick={handleAdd}
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
          )}
        </>
      )}
    </div>
  );
}
