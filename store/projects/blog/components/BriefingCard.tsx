import React from 'react';
import { Link } from '@app/runtime';

export interface BriefingLike {
  id: string;
  title?: string;
  topic: string;
  status?: 'ready' | 'pending' | 'error';
  sourceCount?: number;
}

export function BriefingCard({ briefing }: { briefing: BriefingLike }) {
  const statusClass =
    briefing.status === 'ready'
      ? 'bg-primary text-primary-foreground'
      : briefing.status === 'error'
        ? 'border border-destructive text-destructive'
        : 'border border-border text-muted-foreground';

  return (
    <Link
      href={`/briefings/${briefing.id}`}
      className="block space-y-2 rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-foreground">{briefing.title ?? briefing.topic}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
          {briefing.status ?? 'pending'}
        </span>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{briefing.topic}</p>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{briefing.sourceCount ?? 0} sources</span>
      </div>
    </Link>
  );
}
