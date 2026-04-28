'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { safeFetch } from '@/lib/fetch';

interface ImportResult {
  success: boolean;
  league?: { id: string; name: string; slug: string };
  imported?: {
    teams: number;
    players: number;
    fixtures: number;
    config: boolean;
    table: boolean;
  };
  warnings?: string[];
  error?: string;
}

export default function ImportPage() {
  const { data: session } = useSession();
  const [leagueName, setLeagueName] = useState('');
  const [leagueSlug, setLeagueSlug] = useState('');
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [rosterFiles, setRosterFiles] = useState<FileList | null>(null);
  const [fixturesFile, setFixturesFile] = useState<File | null>(null);
  const [tableFile, setTableFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName || !leagueSlug) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('leagueName', leagueName);
    formData.append('leagueSlug', leagueSlug);
    if (configFile) formData.append('config', configFile);
    if (rosterFiles) {
      for (let i = 0; i < rosterFiles.length; i++) {
        formData.append('rosters', rosterFiles[i]);
      }
    }
    if (fixturesFile) formData.append('fixtures', fixturesFile);
    if (tableFile) formData.append('table', tableFile);

    try {
      const res = await safeFetch('/api/leagues/import', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: 'Upload failed' });
    }
    setImporting(false);
  };

  if (!session?.user) {
    return (
      <div className="text-center mt-20">
        <h1 className="text-2xl font-bold mb-4">Import Legacy League</h1>
        <p className="text-muted-foreground mb-4">Sign in to import a legacy NSMS league.</p>
        <Link href="/login" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href="/leagues" className="hover:text-foreground">Leagues</Link>
        <span>/</span>
        <span>Import</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Import Legacy ESMS League</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Upload your legacy ESMS files to create a new league on the platform. Supports roster files (.txt), league.dat config, fixtures.txt, and table.txt.
      </p>

      <form onSubmit={handleImport} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">League Name *</label>
            <input type="text" value={leagueName} onChange={(e) => setLeagueName(e.target.value)} required
              placeholder="e.g. Sunday League 2025" className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-muted-foreground">URL Slug *</label>
            <input type="text" value={leagueSlug} onChange={(e) => setLeagueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required
              placeholder="e.g. sunday-league-2025" className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="space-y-4">
          <FileInput label="League Config (league.dat)" hint="Key=value pairs with optional Abbreviations section" file={configFile} onChange={setConfigFile} />
          <FileInput label="Roster Files (.txt)" hint="One or more roster files named by abbreviation (e.g. ape.txt, klm.txt). The filename becomes the team abbreviation." file={rosterFiles} onChange={setRosterFiles} multiple />
          <FileInput label="Fixtures (fixtures.txt)" hint="Week-numbered fixture list with 'Home - Away' format" file={fixturesFile} onChange={setFixturesFile} />
          <FileInput label="League Table (table.txt)" hint="Sorted league standings with columns: Pl Team P W D L GF GA GD Pts" file={tableFile} onChange={setTableFile} />
        </div>

        <div className="pt-2">
          <button type="submit" disabled={importing}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:bg-primary-dark">
            {importing ? 'Importing...' : 'Import League'}
          </button>
        </div>
      </form>

      {result && (
        <div className={`mt-6 p-5 rounded-lg border ${result.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          {result.success ? (
            <>
              <h2 className="text-lg font-semibold text-green-400 mb-3">Import Successful</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 text-sm">
                <div className="p-2 bg-card rounded">
                  <div className="text-muted-foreground">Teams</div>
                  <div className="text-lg font-bold">{result.imported?.teams ?? 0}</div>
                </div>
                <div className="p-2 bg-card rounded">
                  <div className="text-muted-foreground">Players</div>
                  <div className="text-lg font-bold">{result.imported?.players ?? 0}</div>
                </div>
                <div className="p-2 bg-card rounded">
                  <div className="text-muted-foreground">Fixtures</div>
                  <div className="text-lg font-bold">{result.imported?.fixtures ?? 0}</div>
                </div>
                <div className="p-2 bg-card rounded">
                  <div className="text-muted-foreground">Config</div>
                  <div className="text-lg font-bold">{result.imported?.config ? 'Yes' : 'No'}</div>
                </div>
                <div className="p-2 bg-card rounded">
                  <div className="text-muted-foreground">Table</div>
                  <div className="text-lg font-bold">{result.imported?.table ? 'Yes' : 'No'}</div>
                </div>
              </div>
              {result.warnings && result.warnings.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-yellow-400 mb-1">Warnings</h3>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {result.league && (
                <Link href={`/leagues/${result.league.slug}`} className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark">
                  Go to League &rarr;
                </Link>
              )}
            </>
          ) : (
            <h2 className="text-lg font-semibold text-red-400">{result.error || 'Import failed'}</h2>
          )}
        </div>
      )}

      <div className="mt-10 p-5 border border-border rounded-lg bg-card">
        <h2 className="text-lg font-semibold mb-3">Supported File Formats</h2>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h3 className="font-medium text-foreground mb-1">league.dat (Config)</h3>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto">{`home_bonus = 200
dp_for_yellow = 4
dp_for_red = 10
suspension_margin = 10

Abilities:
AB_Goal = 50
AB_Assist = 35

Abbreviations:
ape = Apes_United
klm = KLM_Royal_Club`}</pre>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-1">Roster (ape.txt)</h3>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto">{`Name         Age Nat Prs St Tk Ps Sh Sm Ag KAb TAb PAb SAb Gam Sav Ktk Kps Sht Gls Ass  DP Inj Sus Fit
------------------------------------------------------------------------------------------------------
O_Voishtato   24 jap   C 17  3  4  5 42 33 300 300 300 300   0   0   0   0   0   0   0   0   0   0 100
R_Lisht       18 eng   C 15  5  4  5 63 29 300 300 300 300   0   0   0   0   0   0   0   0   0   0 100`}</pre>
            <p className="mt-1 text-xs">Filename becomes the team abbreviation. Upload multiple roster files at once.</p>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-1">fixtures.txt</h3>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto">{`1.

Apes_United - KLM_Royal_Club

2.

KLM_Royal_Club - Apes_United`}</pre>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-1">table.txt</h3>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto">{`Pl   Team                    P    W   D   L    GF   GA   GD   Pts
-----------------------------------------------------------------
1    Apes_United            4    2   2   0     3    1    2     8
2    KLM_Royal_Club         4    2   0   2     5    4    1     6`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileInput({ label, hint, file, onChange, multiple = false }: {
  label: string;
  hint: string;
  file: File | FileList | null;
  onChange: (f: File | FileList | null) => void;
  multiple?: boolean;
}) {
  const fileNames = file
    ? file instanceof FileList
      ? Array.from(file).map((f) => f.name).join(', ')
      : file.name
    : '';

  return (
    <div>
      <label className="block text-sm font-medium mb-1 text-muted-foreground">{label}</label>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <input
        type="file"
        accept=".txt,.dat"
        multiple={multiple}
        onChange={(e) => onChange(e.target.files)}
        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-card file:text-foreground hover:file:bg-secondary cursor-pointer"
      />
      {fileNames && <p className="text-xs text-primary mt-1">{fileNames}</p>}
    </div>
  );
}
