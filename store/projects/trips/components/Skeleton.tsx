import React from 'react';

// Token-driven shimmer blocks used instead of a bare centered spinner, so a page
// keeps its shape while loading. `bg-muted` + `animate-pulse` only — no raw color.
// Respects reduced-motion via the design system's animate utilities.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} aria-hidden />;
}

/** A card-shaped skeleton with a few text lines — the default list placeholder. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i % 2 === 0 ? 'w-full' : 'w-4/5'}`} />
      ))}
    </div>
  );
}

/** A vertical stack of skeleton cards for list/timeline loading states. */
export function SkeletonList({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}
