'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/fetch';

interface Team {
  id: number;
  name: string;
  abbreviation: string;
  budget: number;
}

interface Listing {
  id: number;
  player_id: number;
  from_team_id: number;
  asking_price: number;
  status: string;
  player_name: string;
  age: number;
  nationality: string;
  pref_side: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  sm: number;
  ag: number;
  fitness: number;
  injury: number;
  suspension: number;
  team_name: string;
  team_abbr: string;
}

interface Offer {
  id: number;
  listing_id: number;
  from_team_id: number;
  to_team_id: number;
  player_id: number;
  amount: number;
  status: string;
  player_name: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  from_team_name: string;
  offering_team_name?: string;
}

interface LogEntry {
  id: number;
  player_name: string;
  from_team_name: string;
  to_team_name: string;
  amount: number;
  created_at: string;
}

type Tab = 'market' | 'my_listings' | 'incoming' | 'log';

const SKILL_COLS = [
  { key: 'st', label: 'ST' },
  { key: 'tk', label: 'TK' },
  { key: 'ps', label: 'PS' },
  { key: 'sh', label: 'SH' },
] as const;

export default function TransferMarketPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<Offer[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [loading, setLoading] = useState(true);
  const [offerAmount, setOfferAmount] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [slug]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/teams`);
      if (res.ok) {
        const data: Team[] = await res.json();
        setTeams(data);
        if (data.length > 0 && !selectedTeam) setSelectedTeam(data[0].id);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (selectedTeam && activeTab === 'market') fetchMarketData();
  }, [activeTab, selectedTeam]);

  const fetchMarketData = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/transfers`);
      if (res.ok) setListings(await res.json());
    } catch {}
  };

  const fetchIncoming = async () => {
    if (!selectedTeam) return;
    try {
      const res = await fetch(`/api/leagues/${slug}/transfers?view=offers_incoming&team_id=${selectedTeam}`);
      if (res.ok) setIncomingOffers(await res.json());
    } catch {}
  };

  const fetchLog = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/transfers?view=log`);
      if (res.ok) setLog(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'market') fetchMarketData();
    else if (activeTab === 'incoming') fetchIncoming();
    else if (activeTab === 'log') fetchLog();
  }, [activeTab]);

  const makeOffer = async (listing: Listing) => {
    if (!selectedTeam) return alert('Select your team first');
    if (selectedTeam === listing.from_team_id) return alert('Cannot bid on your own player');
    const amount = parseInt(offerAmount[listing.id] || '0');
    if (!amount || amount <= 0) return alert('Enter a valid amount');
    const team = teams.find(t => t.id === selectedTeam);
    if (team && team.budget < amount) return alert('Insufficient budget');

    setSubmitting(listing.id);
    try {
      const res = await fetch(`/api/leagues/${slug}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'offer',
          listing_id: listing.id,
          from_team_id: listing.from_team_id,
          to_team_id: selectedTeam,
          player_id: listing.player_id,
          amount,
        }),
      });
      if (res.ok) {
        setOfferAmount(prev => ({ ...prev, [listing.id]: '' }));
        fetchMarketData();
      } else {
        const data = await res.json();
        alert(data.error || 'Offer failed');
      }
    } catch { alert('Offer failed'); }
    setSubmitting(null);
  };

  const acceptOffer = async (offerId: number) => {
    try {
      const res = await fetch(`/api/leagues/${slug}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_offer', offer_id: offerId }),
      });
      if (res.ok) { fetchIncoming(); fetchMarketData(); }
      else { const data = await res.json(); alert(data.error || 'Failed'); }
    } catch { alert('Failed'); }
  };

  const rejectOffer = async (offerId: number) => {
    try {
      await safeFetch(`/api/leagues/${slug}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject_offer', offer_id: offerId }),
      });
      fetchIncoming();
    } catch {}
  };

  const withdrawListing = async (listingId: number) => {
    try {
      await fetch(`/api/leagues/${slug}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', listing_id: listingId }),
      });
      fetchMarketData();
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTeam = teams.find(t => t.id === selectedTeam);
  const myListings = listings.filter(l => l.from_team_id === selectedTeam);
  const otherListings = listings.filter(l => l.from_team_id !== selectedTeam);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'market', label: 'Market' },
    { key: 'my_listings', label: 'My Listings' },
    { key: 'incoming', label: 'Incoming Offers' },
    { key: 'log', label: 'Transfer Log' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
        <span>/</span>
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Transfer Market</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transfer Market</h1>
        <div className="flex items-center gap-3">
          <select value={selectedTeam || ''} onChange={e => setSelectedTeam(parseInt(e.target.value))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {currentTeam && (
            <span className="text-sm text-muted-foreground">
              Budget: <span className="font-medium text-foreground">{(currentTeam.budget || 0).toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'market' && (
        <div>
          {otherListings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No players on the market right now.</p>
          ) : (
            <div className="space-y-3">
              {otherListings.map(l => (
                <div key={l.id} className="border border-border rounded-lg bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{l.player_name}</h3>
                        <span className="text-xs text-muted-foreground">Age {l.age}</span>
                        <span className="text-xs text-muted-foreground">{l.nationality}</span>
                        <span className="text-xs font-mono text-muted-foreground">{l.pref_side}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {SKILL_COLS.map(col => (
                          <span key={col.key} className="text-center">
                            <span className="text-xs text-muted-foreground">{col.label}</span>
                            <span className="ml-1 font-medium">{(l as unknown as Record<string, number>)[col.key]}</span>
                          </span>
                        ))}
                        <span className="text-center">
                          <span className="text-xs text-muted-foreground">Fit</span>
                          <span className="ml-1 font-medium">{l.fitness}</span>
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        From: <span className="font-medium text-foreground">{l.team_name}</span> ({l.team_abbr})
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-muted-foreground mb-1">Asking Price</p>
                      <p className="text-lg font-bold text-primary">{l.asking_price.toLocaleString()}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="number" value={offerAmount[l.id] || ''} onChange={e => setOfferAmount(prev => ({ ...prev, [l.id]: e.target.value }))}
                          className="w-24 px-2 py-1 bg-background border border-border rounded text-sm text-right" placeholder="0" min={0} />
                        <button onClick={() => makeOffer(l)} disabled={submitting === l.id || !selectedTeam}
                          className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50">
                          {submitting === l.id ? '...' : 'Bid'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'my_listings' && (
        <div>
          {myListings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No active listings. Go to your{' '}
              <Link href={`/leagues/${slug}/teams/${selectedTeam}`} className="text-primary hover:underline">team page</Link>{' '}
              to list players for transfer.
            </p>
          ) : (
            <div className="space-y-3">
              {myListings.map(l => (
                <div key={l.id} className="border border-border rounded-lg bg-card p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{l.player_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ST {l.st} / TK {l.tk} / PS {l.ps} / SH {l.sh} &middot; Age {l.age} &middot; Fit {l.fitness}%
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-primary">{l.asking_price.toLocaleString()}</span>
                    <button onClick={() => withdrawListing(l.id)}
                      className="px-3 py-1 border border-border rounded-lg text-sm hover:bg-card">
                      Withdraw
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'incoming' && (
        <div>
          {incomingOffers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No incoming offers for your listed players.</p>
          ) : (
            <div className="space-y-3">
              {incomingOffers.map(o => (
                <div key={o.id} className="border border-border rounded-lg bg-card p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{o.player_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Offer from: <span className="font-medium text-foreground">{o.offering_team_name || o.from_team_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">ST {o.st} / TK {o.tk} / PS {o.ps} / SH {o.sh}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary">{o.amount.toLocaleString()}</span>
                    <button onClick={() => acceptOffer(o.id)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                      Accept
                    </button>
                    <button onClick={() => rejectOffer(o.id)}
                      className="px-3 py-1.5 border border-destructive text-destructive rounded-lg text-sm font-medium">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'log' && (
        <div>
          {log.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No transfers completed yet.</p>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="divide-y divide-border/50">
                {log.map(entry => (
                  <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{entry.player_name}</span>
                      <span className="text-muted-foreground text-sm">
                        {entry.from_team_name} &rarr; {entry.to_team_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">{entry.amount.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
