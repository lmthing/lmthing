import React from 'react';

/**
 * Layout-matching skeleton placeholders so pages don't jump from a bare spinner
 * to content. All surfaces use design tokens (`bg-muted`, `border-border`).
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/** A single feed-card skeleton (thumbnail + headline + deck + chips). */
export function ArticleCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-4">
      <div className="h-24 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="min-w-0 flex-1 space-y-3 py-1">
        <Bar className="h-4 w-3/4" />
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-5/6" />
        <div className="flex gap-2 pt-1">
          <Bar className="h-4 w-14 rounded-full" />
          <Bar className="h-4 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A vertical stack of feed-card skeletons. */
export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A generic list-row skeleton (topics, sources, digests). */
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="w-full space-y-2">
            <Bar className="h-4 w-1/3" />
            <Bar className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
