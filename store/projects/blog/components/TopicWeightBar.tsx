import React from 'react';

export function TopicWeightBar({
  slug,
  weight,
  max = 3,
}: {
  slug: string;
  weight: number;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (Math.max(0, weight) / (max || 1)) * 100));

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">#{slug}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-agent" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
        {weight.toFixed(1)}
      </span>
    </div>
  );
}
