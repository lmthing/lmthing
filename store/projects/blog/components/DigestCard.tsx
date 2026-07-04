import React from 'react';
import { Link } from '@app/runtime';

export interface DigestLike {
  id: string;
  title: string;
  summary?: string;
  period?: string;
  status?: string;
  articleCount?: number;
  createdAt?: string;
}

export function DigestCard({ digest }: { digest: DigestLike }) {
  const statusClass =
    digest.status === 'ready'
      ? 'bg-primary text-primary-foreground'
      : digest.status === 'error'
        ? 'border border-destructive text-destructive'
        : 'border border-border text-muted-foreground';

  return (
    <Link
      href={`/digests/${digest.id}`}
      className="block space-y-2 rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-foreground">{digest.title}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
          {digest.status ?? 'ready'}
        </span>
      </div>

      {digest.summary ? (
        <p className="text-sm text-muted-foreground line-clamp-3">{digest.summary}</p>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {digest.period ?? 'daily'}
        </span>
        <span className="text-xs text-muted-foreground">{digest.articleCount ?? 0} articles</span>
      </div>
    </Link>
  );
}
