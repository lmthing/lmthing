import React from 'react';
import { scoreSegments } from './format';

/**
 * A subtle 3-segment relevance meter driven by `articles.score`. Filled
 * segments use `bg-primary`; empty ones `bg-muted`. Purely presentational.
 */
export function RelevanceMeter({
  score,
  className = '',
}: {
  score: number | undefined | null;
  className?: string;
}) {
  const filled = scoreSegments(score);
  const label = filled >= 3 ? 'High relevance' : filled === 2 ? 'Relevant' : filled === 1 ? 'Some relevance' : 'Low relevance';
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      title={label}
      aria-label={label}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1 w-3 rounded-full ${i < filled ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </span>
  );
}
