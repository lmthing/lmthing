import React from 'react';
import type { TransitLeg } from '@app/types';
import { formatDate, formatMoney } from './format';

function formatDuration(minutes?: number): string {
  if (!minutes && minutes !== 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function statusClass(status: string): string {
  if (status === 'confirmed') return 'text-primary';
  return 'text-muted-foreground';
}

export function TransitLegRow({
  leg,
}: {
  leg: TransitLeg & { fromName?: string; toName?: string };
}) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-foreground">
          {leg.fromName ?? 'Home'} → {leg.toName}
        </span>
        <span className={`rounded-full border border-border bg-background px-2 py-0.5 text-xs ${statusClass(leg.status)}`}>
          {leg.status}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {leg.mode}
        {leg.durationMinutes ? ` · ${formatDuration(leg.durationMinutes)}` : ''}
        {leg.estimatedCost ? ` · ${formatMoney(leg.estimatedCost, leg.currency)}` : ''}
      </p>
      {leg.bookByDate ? (
        <p className="text-sm text-muted-foreground">Book by {formatDate(leg.bookByDate)}</p>
      ) : null}
    </div>
  );
}
