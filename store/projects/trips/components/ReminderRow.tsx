import React from 'react';
import type { ItineraryItem } from '@app/types';

function urgencyClass(urgency: string): string {
  if (urgency === 'overdue') return 'text-destructive';
  if (urgency === 'soon') return 'text-primary';
  return 'text-muted-foreground';
}

export function ReminderRow({
  reminder,
}: {
  reminder: ItineraryItem & { daysLeft: number | null; urgency: string };
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-foreground">{reminder.title}</p>
        {reminder.bookByDate ? (
          <p className="text-sm text-muted-foreground">Book by {reminder.bookByDate}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-sm font-medium ${urgencyClass(reminder.urgency)}`}>
          {reminder.daysLeft === null
            ? 'no deadline'
            : reminder.daysLeft < 0
              ? `${Math.abs(reminder.daysLeft)}d overdue`
              : `${reminder.daysLeft}d left`}
        </span>
      </div>
    </div>
  );
}
