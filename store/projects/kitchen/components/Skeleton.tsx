import React from 'react';

/**
 * Content-shaped loading placeholders. Uses the `muted` token for the shimmer and honors
 * `prefers-reduced-motion` (the pulse is disabled under `motion-reduce`).
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className}`}
      aria-hidden
    />
  );
}

/** A skeleton shaped like the week grid — a labels column + N day columns of meal cells. */
export function WeekGridSkeleton({ days = 7 }: { days?: number }) {
  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading this week">
      <div
        className="grid min-w-[640px] gap-2"
        style={{ gridTemplateColumns: `6rem repeat(${days}, minmax(0, 1fr))` }}
      >
        <div />
        {Array.from({ length: days }).map((_, i) => (
          <Skeleton key={`h${i}`} className="mx-auto h-3 w-10" />
        ))}
        {['breakfast', 'lunch', 'dinner'].map((slot) => (
          <React.Fragment key={slot}>
            <Skeleton className="h-3 w-16" />
            {Array.from({ length: days }).map((_, i) => (
              <Skeleton key={`${slot}${i}`} className="h-[5.5rem] w-full" />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** A skeleton shaped like a grid of recipe cards. */
export function RecipeCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading recipes"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
