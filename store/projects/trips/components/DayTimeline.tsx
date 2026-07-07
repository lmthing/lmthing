import React from 'react';
import type { ItineraryItem } from '@app/types';
import { ItineraryCard } from './ItineraryCard';
import { formatDate } from './format';
import { AlertTriangleIcon, ClockIcon } from './icons';

// A single day as a vertical time-gutter timeline. Timed items (with a
// `startTime`) sit against an hour gutter in chronological order; flexible
// (null-time) items float in an "anytime" tray at the top. Overlaps between
// consecutive timed items surface an inline conflict warning; large empty
// stretches surface a subtle gap marker. This is where the schema's
// startTime/endTime finally pays off visually.

function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function label(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function DayTimeline({ date, items }: { date: string; items: ItineraryItem[] }) {
  const anytime = items.filter((i) => toMinutes(i.startTime) == null);
  const timed = items
    .filter((i) => toMinutes(i.startTime) != null)
    .sort((a, b) => (toMinutes(a.startTime)! - toMinutes(b.startTime)!));

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {formatDate(date) || date || 'Unscheduled'}
      </h3>

      {anytime.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="h-3.5 w-3.5" />
            Anytime
          </p>
          <div className="space-y-2">
            {anytime.map((item) => (
              <ItineraryCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {timed.length > 0 ? (
        <div className="space-y-2">
          {timed.map((item, idx) => {
            const start = toMinutes(item.startTime)!;
            const end = toMinutes(item.endTime);
            const prev = timed[idx - 1];
            const prevEnd = prev ? toMinutes(prev.endTime) ?? toMinutes(prev.startTime) : null;

            // Conflict: this item starts before the previous one ends.
            const conflict = prevEnd != null && start < prevEnd;
            // Gap: a clear stretch of 3h+ of nothing since the previous item ended.
            const gap = prevEnd != null && !conflict && start - prevEnd >= 180;

            return (
              <React.Fragment key={item.id}>
                {conflict ? (
                  <div className="ml-14 flex items-center gap-1.5 rounded-md border border-destructive/60 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                    <AlertTriangleIcon className="h-3.5 w-3.5" />
                    Overlaps the previous item — check timing.
                  </div>
                ) : null}
                {gap ? (
                  <div className="ml-14 text-xs text-muted-foreground">
                    · {Math.round((start - prevEnd!) / 60)}h free
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <div className="w-11 shrink-0 pt-3 text-right text-xs tabular-nums text-muted-foreground">
                    {label(start)}
                    {end != null ? <div className="text-[10px] opacity-70">{label(end)}</div> : null}
                  </div>
                  <div className="relative flex-1 border-l border-border pl-3">
                    <span
                      className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                      aria-hidden
                    />
                    <ItineraryCard item={item} />
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
      ) : null}
    </section>
  );
}
