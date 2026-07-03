import React from 'react';
import { Link } from '@app/runtime';

export interface Stats {
  unread: number;
  saved: number;
  total: number;
  sources: number;
  tags: { tag: string; count: number }[];
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatsStrip({ stats }: { stats: Stats }) {
  const topTags = (stats.tags ?? []).slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Tile label="Unread" value={stats.unread ?? 0} />
        <Tile label="Saved" value={stats.saved ?? 0} />
        <Tile label="Total" value={stats.total ?? 0} />
        <Tile label="Sources" value={stats.sources ?? 0} />
      </div>

      {topTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topTags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/tag/${tag}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary"
            >
              #{tag} <span className="text-muted-foreground">({count})</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
