import React from 'react';
import { TopicWeightBar } from './TopicWeightBar';

export interface InsightsLike {
  totalRead?: number;
  totalSaved?: number;
  totalDismissed?: number;
  byTag?: { tag: string; count: number }[];
  byDay?: { day: string; count: number }[];
  topTopics?: { slug: string; weight: number }[];
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-2xl font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

export function InsightsPanel({ insights }: { insights: InsightsLike }) {
  const byTag = insights.byTag ?? [];
  const byDay = insights.byDay ?? [];
  const topTopics = insights.topTopics ?? [];
  const tagMax = Math.max(1, ...byTag.map((t) => t.count));
  const dayMax = Math.max(1, ...byDay.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Tile label="Read" value={insights.totalRead ?? 0} />
        <Tile label="Saved" value={insights.totalSaved ?? 0} />
        <Tile label="Dismissed" value={insights.totalDismissed ?? 0} />
      </div>

      {byTag.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">By tag</h3>
          <div className="space-y-1.5">
            {byTag.map((t) => (
              <BarRow key={t.tag} label={`#${t.tag}`} count={t.count} max={tagMax} />
            ))}
          </div>
        </section>
      ) : null}

      {byDay.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">By day</h3>
          <div className="space-y-1.5">
            {byDay.map((d) => (
              <BarRow key={d.day} label={d.day} count={d.count} max={dayMax} />
            ))}
          </div>
        </section>
      ) : null}

      {topTopics.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">Top topics</h3>
          <div className="space-y-1.5">
            {topTopics.map((t) => (
              <TopicWeightBar key={t.slug} slug={t.slug} weight={t.weight} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
