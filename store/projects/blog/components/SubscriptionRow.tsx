import React from 'react';

export interface SubscriptionLike {
  id: string;
  name: string;
  query?: { keyword?: string; tags?: string[] };
  cadence?: string;
  channel?: string;
  active?: boolean;
}

export function SubscriptionRow({
  subscription,
  onToggle,
  onRemove,
}: {
  subscription: SubscriptionLike;
  onToggle?: () => void;
  onRemove?: () => void;
}) {
  const tags = subscription.query?.tags ?? [];
  const keyword = subscription.query?.keyword;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="font-bold text-foreground">{subscription.name}</span>
        <p className="text-sm text-muted-foreground">
          {keyword ? `“${keyword}”` : null}
          {keyword && tags.length > 0 ? ' · ' : null}
          {tags.length > 0 ? tags.map((t) => `#${t}`).join(' ') : null}
          {!keyword && tags.length === 0 ? 'No filters' : null}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {subscription.cadence ?? 'daily'}
          </span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {subscription.channel ?? 'in-app'}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className={
              subscription.active
                ? 'rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground'
                : 'rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted'
            }
          >
            {subscription.active ? 'Active' : 'Paused'}
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
