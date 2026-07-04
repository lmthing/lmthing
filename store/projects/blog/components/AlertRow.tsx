import React from 'react';
import { Link } from '@app/runtime';

export interface AlertLike {
  id: string;
  title: string;
  summary?: string;
  read?: boolean;
  articleId?: string;
}

export function AlertRow({
  alert,
  onMarkRead,
}: {
  alert: AlertLike;
  onMarkRead?: () => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors"
      onClick={!alert.read ? onMarkRead : undefined}
      role={!alert.read && onMarkRead ? 'button' : undefined}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {!alert.read ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              New
            </span>
          ) : null}
          <span className="font-bold text-foreground">{alert.title}</span>
        </div>
        {alert.summary ? <p className="text-sm text-muted-foreground">{alert.summary}</p> : null}
        {alert.articleId ? (
          <Link
            href={`/feed/${alert.articleId}`}
            className="text-sm text-primary hover:underline"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            View article →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
