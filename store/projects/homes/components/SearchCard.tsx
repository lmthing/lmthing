import React from 'react';
import type { Search } from '@app/types';
import { Link } from '@app/runtime';
import { formatMoney } from './format';

type SearchWithCounts = Search & { unreadAlerts?: number; newListings?: number };

export function SearchCard({ search }: { search: SearchWithCounts }) {
  const modePillClass =
    search.mode === 'buy'
      ? 'rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground'
      : 'rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground';

  const newListings = search.newListings ?? 0;
  const unreadAlerts = search.unreadAlerts ?? 0;

  return (
    <Link
      href={`/searches/${search.id}`}
      className="block space-y-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-foreground">{search.title}</span>
        <span className={modePillClass}>{search.mode}</span>
      </div>

      {search.area ? <p className="text-sm text-muted-foreground">{search.area}</p> : null}

      <p className="text-sm text-muted-foreground">
        up to{' '}
        <span className="font-medium text-foreground">
          {formatMoney(search.budgetMax, search.currency)}
        </span>
        {search.mode === 'rent' ? '/mo' : ''}
      </p>

      <div className="flex items-center gap-2 pt-1">
        {newListings > 0 ? (
          <span className="rounded-full bg-agent px-2 py-0.5 text-xs font-medium text-agent-foreground">
            {newListings} new
          </span>
        ) : null}
        {unreadAlerts > 0 ? (
          <span className="rounded-full border border-primary px-2 py-0.5 text-xs text-primary">
            {unreadAlerts} alert{unreadAlerts === 1 ? '' : 's'}
          </span>
        ) : null}
        {newListings === 0 && unreadAlerts === 0 ? (
          <span className="text-xs text-muted-foreground">All caught up</span>
        ) : null}
      </div>
    </Link>
  );
}
