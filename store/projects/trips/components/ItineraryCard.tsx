import React from 'react';
import type { ItineraryItem } from '@app/types';

function kindBadgeClass(): string {
  return 'shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground';
}

export function ItineraryCard({ item }: { item: ItineraryItem }) {
  const time = [item.startTime, item.endTime].filter(Boolean).join(' – ');

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{item.title}</span>
        <span className={kindBadgeClass()}>{item.kind}</span>
      </div>
      {time ? <p className="text-sm text-muted-foreground">{time}</p> : null}
      {item.location ? <p className="text-sm text-muted-foreground">{item.location}</p> : null}
      {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}
      {item.estimatedCost > 0 ? (
        <p className="text-sm text-foreground">
          {item.estimatedCost} {item.currency}
        </p>
      ) : null}
    </div>
  );
}
