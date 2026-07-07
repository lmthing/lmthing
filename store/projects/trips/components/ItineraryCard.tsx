import React from 'react';
import type { ItineraryItem } from '@app/types';
import { useApiMutation } from '@app/runtime';
import { formatDate, formatMoney } from './format';
import { TrashIcon } from './icons';
import { kindStyle } from './kind';

export function ItineraryCard({ item }: { item: ItineraryItem }) {
  const removeItem = useApiMutation<{ ok: boolean }>('removeItem', {
    invalidates: ['getTrip', 'tripBudget', 'tripFinances', 'tripReminders'],
  });
  const time = [item.startTime, item.endTime].filter(Boolean).join(' – ');
  const style = kindStyle(item.kind);
  const badgeClass = `shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs ${style.toneClass}`;

  return (
    <div
      className="group space-y-1.5 rounded-lg border border-l-4 border-border bg-card p-3"
      style={{ borderLeftColor: style.colorVar }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{item.title}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className={badgeClass}>{style.label}</span>
          <button
            type="button"
            onClick={() => removeItem.mutate({ id: item.id })}
            disabled={removeItem.isPending}
            title="Remove item"
            className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {time ? <p className="text-sm text-muted-foreground">{time}</p> : null}
      {item.location ? <p className="text-sm text-muted-foreground">{item.location}</p> : null}
      {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}
      {item.weatherNote ? (
        <p className="text-sm text-muted-foreground">☁ {item.weatherNote}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
        {item.estimatedCost > 0 ? (
          <span className="text-sm text-foreground">
            {formatMoney(item.estimatedCost, item.currency)}
          </span>
        ) : null}
        {item.needsBooking ? (
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {item.bookByDate ? `book by ${formatDate(item.bookByDate)}` : 'needs booking'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
