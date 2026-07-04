import React from 'react';
import type { Booking } from '@app/types';

export function BookingRow({ booking }: { booking: Booking }) {
  const dates = [booking.startAt, booking.endAt].filter(Boolean).join(' – ');

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {booking.kind}
          </span>
          {booking.provider ? (
            <span className="font-medium text-foreground">{booking.provider}</span>
          ) : null}
        </div>
        {booking.confirmation ? (
          <p className="text-sm text-muted-foreground">Confirmation: {booking.confirmation}</p>
        ) : null}
        {dates ? <p className="text-sm text-muted-foreground">{dates}</p> : null}
      </div>
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-sm font-medium text-foreground">{booking.cost}</p>
        {booking.url ? (
          <a
            href={booking.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View
          </a>
        ) : null}
      </div>
    </div>
  );
}
