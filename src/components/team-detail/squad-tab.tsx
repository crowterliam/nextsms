'use client';

import { useState } from 'react';
import { SKILL_COLS } from './constants';
import type { Player } from './types';

interface SquadTabProps {
  players: Player[];
  canManage: boolean;
  onListForTransfer: (playerId: number, askingPrice: number) => void;
}

export function SquadTab({ players, canManage, onListForTransfer }: SquadTabProps) {
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [transferPlayerId, setTransferPlayerId] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState('');

  const sortedPlayers = [...players].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleListTransfer = () => {
    if (!transferPlayerId || !askingPrice) return;
    onListForTransfer(transferPlayerId, parseInt(askingPrice));
    setTransferPlayerId(null);
    setAskingPrice('');
  };

  return (
    <div>
      {canManage && transferPlayerId && (
        <div className="mb-4 p-4 border border-primary/30 rounded-lg bg-primary/5 flex items-end gap-3">
          <span className="text-sm">List <strong>{players.find(p => p.id === transferPlayerId)?.name}</strong> for:</span>
          <input type="number" value={askingPrice} onChange={e => setAskingPrice(e.target.value)}
            className="w-32 px-3 py-1.5 bg-background border border-border rounded-lg text-sm" placeholder="Price" min={0} />
          <button onClick={handleListTransfer}
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
                          (p as unknown as Record<string, number>)[col.key] >= 90 ? 'text-primary font-semibold' :
                          (p as unknown as Record<string, number>)[col.key] >= 75 ? 'text-primary-light' :
                          'text-muted-foreground'
                        }`}>
                          {(p as unknown as Record<string, number>)[col.key]}
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
  );
}
