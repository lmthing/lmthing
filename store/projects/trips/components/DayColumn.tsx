import React from 'react';
import type { ItineraryItem } from '@app/types';
import { ItineraryCard } from './ItineraryCard';
import { formatDate } from './format';

export function DayColumn({ date, items }: { date: string; items: ItineraryItem[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {formatDate(date) || date}
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <ItineraryCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
