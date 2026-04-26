'use client';

import Link from 'next/link';

interface TransfersTabProps {
  slug: string;
}

export function TransfersTab({ slug }: TransfersTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Transfer Market</h2>
        <Link href={`/leagues/${slug}/transfers`}
          className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/10">
          View Full Market
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Go to the <strong>Squad</strong> tab to list players for transfer. Visit the{' '}
        <Link href={`/leagues/${slug}/transfers`} className="text-primary hover:underline">Transfer Market</Link>{' '}
        to browse and bid on available players.
      </p>
    </div>
  );
}
