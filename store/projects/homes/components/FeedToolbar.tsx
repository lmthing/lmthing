import React from 'react';
import { SortIcon, FilterIcon, KeyboardIcon } from './icons';

export type FeedSort = 'score' | 'trueCost' | 'newest' | 'commute';
export type FeedFilter = 'all' | 'new' | 'shortlisted' | 'flagged' | 'underBudget';

const SORTS: { key: FeedSort; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'trueCost', label: 'True cost' },
  { key: 'newest', label: 'Newest' },
  { key: 'commute', label: 'Commute' },
];

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'flagged', label: 'Has flags' },
  { key: 'underBudget', label: 'Under budget' },
];

// The triage-cockpit toolbar — sort + segmented filter, all applied client-side
// over the listingFeed array (no new endpoint). Counts show how many match.
export function FeedToolbar({
  sort,
  filter,
  counts,
  onSort,
  onFilter,
}: {
  sort: FeedSort;
  filter: FeedFilter;
  counts: Record<FeedFilter, number>;
  onSort: (s: FeedSort) => void;
  onFilter: (f: FeedFilter) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter listings">
        <FilterIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(f.key)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                (active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              {f.label}
              <span className={active ? 'ml-1 opacity-80' : 'ml-1 text-muted-foreground'}>
                {counts[f.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <SortIcon className="h-4 w-4" />
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as FeedSort)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="hidden items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:flex">
          <KeyboardIcon className="h-3.5 w-3.5" />
          j/k move · s save · x dismiss · enter open
        </span>
      </div>
    </div>
  );
}
