'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  SquadTab,
  TacticsTab,
  LineupsTab,
  ConditionalsTab,
  TransfersTab,
  TeamSettings,
} from '@/components/team-detail';
import type { Tab, TeamData, Player, Tactic, SavedLineup } from '@/components/team-detail';

const TABS: { key: Tab; label: string }[] = [
  { key: 'squad', label: 'Squad' },
  { key: 'lineups', label: 'Lineups' },
  { key: 'conditionals', label: 'Conditionals' },
  { key: 'tactics', label: 'Tactics' },
  { key: 'transfers', label: 'Transfers' },
];

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
  const [showSettings, setShowSettings] = useState(false);

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
      }
    } catch {}
    setLoading(false);
  }, [slug, teamId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const saveSettings = async (formation: string, tactic: string, aggression: number) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_formation: formation, default_tactic: tactic, default_aggression: aggression }),
    });
    setShowSettings(false);
    fetchTeam();
  };

  const listPlayerForTransfer = async (playerId: number, askingPrice: number) => {
    await fetch(`/api/leagues/${slug}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', player_id: playerId, team_id: team!.id, asking_price: askingPrice }),
    });
    fetchTeam();
  };

  const saveTactic = async (tacticCode: string, aggression: number) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/tactics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tactic_code: tacticCode, aggression, is_default: tactics.length === 0 }),
    });
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

  const generateLineup = async (formation: string, tacticCode: string, name: string, aggression: number) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'auto_generate', formation, tactic_code: tacticCode, name, aggression, set_active: true }),
    });
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

  const updateLineup = async (lineupId: number, updates: Record<string, unknown>) => {
    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_lineup', lineup_id: lineupId, ...updates }),
    });
    fetchTeam();
  };

  const addConditional = async (lineup: SavedLineup, rawInstruction: string) => {
    const existing = JSON.parse(lineup.conditionals || '[]');
    const items: string[] = existing.map((c: { raw?: string } | string) =>
      typeof c === 'string' ? c : c.raw || JSON.stringify(c)
    );
    items.push(rawInstruction);

    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_conditionals', lineup_id: lineup.id, conditionals: JSON.stringify(items) }),
    });
    fetchTeam();
  };

  const removeConditional = async (lineup: SavedLineup, index: number) => {
    const existing = JSON.parse(lineup.conditionals || '[]');
    const items: string[] = existing.map((c: { raw?: string } | string) =>
      typeof c === 'string' ? c : c.raw || JSON.stringify(c)
    );
    items.splice(index, 1);

    await fetch(`/api/leagues/${slug}/teams/${teamId}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_conditionals', lineup_id: lineup.id, conditionals: JSON.stringify(items) }),
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
        <TeamSettings
          defaultFormation={team.default_formation || '442'}
          defaultTactic={team.default_tactic || 'N'}
          defaultAggression={team.default_aggression || 50}
          onSave={saveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}

      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map(tab => (
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
        <SquadTab players={players} canManage={canManage} onListForTransfer={listPlayerForTransfer} />
      )}
      {activeTab === 'lineups' && (
        <LineupsTab
          lineups={lineups}
          players={players}
          canManage={canManage}
          onGenerate={generateLineup}
          onActivate={activateLineup}
          onDelete={deleteLineup}
          onUpdateLineup={updateLineup}
        />
      )}
      {activeTab === 'conditionals' && (
        <ConditionalsTab lineups={lineups} canManage={canManage} onAdd={addConditional} onRemove={removeConditional} />
      )}
      {activeTab === 'tactics' && (
        <TacticsTab tactics={tactics} canManage={canManage} onSave={saveTactic} onDelete={deleteTactic} />
      )}
      {activeTab === 'transfers' && (
        <TransfersTab slug={slug} />
      )}
    </div>
  );
}
