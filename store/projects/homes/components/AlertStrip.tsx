import React from 'react';
import type { Alert } from '@app/types';
import { Link } from '@app/runtime';

const KIND_CLASS: Record<string, string> = {
  new_match: 'text-agent',
  price_drop: 'text-primary',
  gone: 'text-muted-foreground',
  back_online: 'text-primary',
};

const KIND_GLYPH: Record<string, string> = {
  new_match: '✦',
  price_drop: '↓',
  gone: '⊘',
  back_online: '↻',
};

export function AlertStrip({
  alerts,
  onRead,
}: {
  alerts: Alert[];
  onRead?: (id: string) => void;
}) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={`text-lg leading-none ${KIND_CLASS[a.kind] ?? 'text-foreground'}`}>
              {KIND_GLYPH[a.kind] ?? '•'}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{a.title}</p>
              {a.body ? <p className="line-clamp-1 text-sm text-muted-foreground">{a.body}</p> : null}
              {a.listingId ? (
                <Link
                  href={`/listings/${a.listingId}`}
                  className="text-xs text-primary hover:underline"
                >
                  View listing →
                </Link>
              ) : null}
            </div>
          </div>
          {onRead ? (
            <button
              type="button"
              onClick={() => onRead(a.id)}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
