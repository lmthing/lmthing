import React from 'react';
import type { ItineraryItem } from '@app/types';
import { ItineraryCard } from './ItineraryCard';

export function DayColumn({ date, items }: { date: string; items: ItineraryItem[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase text-muted-foreground">{date}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <ItineraryCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
