import React from 'react';

/**
 * A small badge showing a topic slug and its current personalization weight — shown in chat while
 * the personalizer is discussing or explaining a weight adjustment.
 */
export function TopicWeightBadge({ slug, weight }: { slug: string; weight: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-foreground">
      <span className="font-medium">{slug}</span>
      <span className="text-muted-foreground">{weight.toFixed(2)}</span>
    </span>
  );
}

export default TopicWeightBadge;
