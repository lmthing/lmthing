import React from 'react';

// Layout-preserving skeleton for the feed — token-colored blocks that pulse, so
// the list doesn't jump when real cards arrive. Spinner stays for short actions.
export function ListingCardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-lg border border-border bg-card p-4" aria-hidden>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
        </div>
        <div className="h-11 w-11 shrink-0 rounded-full bg-muted" />
      </div>
      <div className="h-5 w-1/2 rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
      <div className="h-3 w-full rounded bg-muted" />
    </div>
  );
}

export function ListingFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading listings" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
