'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function LeagueTablePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [table, setTable] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTable();
  }, [slug]);

  const fetchTable = async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/table`);
      if (res.ok) setTable(await res.json());
    } catch {}
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
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
