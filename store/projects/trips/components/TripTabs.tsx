import React from 'react';
import { Link } from '@app/runtime';

const TABS: { key: string; label: string; href: (tripId: string) => string }[] = [
  { key: 'timeline', label: 'Timeline', href: (id) => `/trips/${id}` },
  { key: 'plan', label: 'Plan', href: (id) => `/trips/${id}/plan` },
  { key: 'packing', label: 'Packing', href: (id) => `/trips/${id}/packing` },
  { key: 'logistics', label: 'Logistics', href: (id) => `/trips/${id}/logistics` },
  { key: 'documents', label: 'Documents', href: (id) => `/trips/${id}/documents` },
  { key: 'reminders', label: 'Reminders', href: (id) => `/trips/${id}/reminders` },
  { key: 'travelers', label: 'Travelers', href: (id) => `/trips/${id}/travelers` },
  { key: 'expenses', label: 'Expenses', href: (id) => `/trips/${id}/expenses` },
  { key: 'finances', label: 'Finances', href: (id) => `/trips/${id}/finances` },
  { key: 'settlement', label: 'Settlement', href: (id) => `/trips/${id}/settlement` },
  { key: 'deals', label: 'Deals', href: (id) => `/trips/${id}/deals` },
];

export type TripTabKey =
  | 'timeline'
  | 'plan'
  | 'packing'
  | 'logistics'
  | 'documents'
  | 'reminders'
  | 'travelers'
  | 'expenses'
  | 'finances'
  | 'deals'
  | 'settlement';

export function TripTabs({ tripId, active }: { tripId: string; active: TripTabKey }) {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-2">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href(tripId)}
          className={
            tab.key === active
              ? 'text-sm font-medium text-primary'
              : 'text-sm text-muted-foreground hover:text-primary'
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
