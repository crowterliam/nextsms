'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LeagueTablePage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [table, setTable] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [seasonName, setSeasonName] = useState('');
  const [hasSeason, setHasSeason] = useState(true);

  useEffect(() => {
    fetchTable();
  }, [slug]);

  const fetchTable = async () => {
    const [leagueRes, tableRes] = await Promise.all([
      fetch(`/api/leagues/${slug}`).catch(() => null),
      fetch(`/api/leagues/${slug}/table`).catch(() => null),
    ]);

    if (leagueRes?.ok) {
      const league = await leagueRes.json();
      setSeasonName(league.currentSeason?.name || `Season ${league.season}`);
      setHasSeason(league.seasonId !== null);
    }

    if (tableRes?.ok) setTable(await tableRes.json());
    setLoading(false);
  };

  if (!hasSeason && !loading) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
          <span>/</span>
          <span>League Table</span>
        </div>
        <h1 className="text-2xl font-bold mb-6">League Table</h1>
        <div className="text-center py-12 border border-border rounded-lg bg-card">
          <p className="text-muted-foreground mb-4">No season has been created yet.</p>
          <button
            onClick={() => router.push(`/leagues/${slug}`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Go to League Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>{seasonName}</span>
        <span>/</span>
        <span>League Table</span>
      </div>
      <h1 className="text-2xl font-bold mb-6">League Table</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : table.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No standings yet. Play matches to populate the table.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-3 px-2">#</th>
                <th className="text-left py-3 px-2">Team</th>
                <th className="text-center py-3 px-2">P</th>
                <th className="text-center py-3 px-2">W</th>
                <th className="text-center py-3 px-2">D</th>
                <th className="text-center py-3 px-2">L</th>
                <th className="text-center py-3 px-2">GF</th>
                <th className="text-center py-3 px-2">GA</th>
                <th className="text-center py-3 px-2">GD</th>
                <th className="text-center py-3 px-2 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-card">
                  <td className="py-3 px-2">{i + 1}</td>
                  <td className="py-3 px-2 font-medium">{(row as Record<string, string>).team_name}</td>
                  <td className="text-center py-3 px-2">{row.played as number}</td>
                  <td className="text-center py-3 px-2">{row.won as number}</td>
                  <td className="text-center py-3 px-2">{row.drawn as number}</td>
                  <td className="text-center py-3 px-2">{row.lost as number}</td>
                  <td className="text-center py-3 px-2">{row.goals_for as number}</td>
                  <td className="text-center py-3 px-2">{row.goals_against as number}</td>
                  <td className="text-center py-3 px-2">{row.goal_difference as number}</td>
                  <td className="text-center py-3 px-2 font-bold">{row.points as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
