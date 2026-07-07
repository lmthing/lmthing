import React from 'react';
import { Link } from '@app/runtime';
import {
  CalendarIcon,
  SparklesIcon,
  LuggageIcon,
  RouteIcon,
  FileIcon,
  BellIcon,
  UsersIcon,
  ReceiptIcon,
  WalletIcon,
  ScaleIcon,
  TagIcon,
} from './icons';

type TabIcon = ({ className }: { className?: string }) => React.ReactElement;

const TABS: { key: string; label: string; icon: TabIcon; href: (tripId: string) => string }[] = [
  { key: 'timeline', label: 'Timeline', icon: CalendarIcon, href: (id) => `/trips/${id}` },
  { key: 'plan', label: 'Plan', icon: SparklesIcon, href: (id) => `/trips/${id}/plan` },
  { key: 'packing', label: 'Packing', icon: LuggageIcon, href: (id) => `/trips/${id}/packing` },
  { key: 'logistics', label: 'Logistics', icon: RouteIcon, href: (id) => `/trips/${id}/logistics` },
  { key: 'documents', label: 'Documents', icon: FileIcon, href: (id) => `/trips/${id}/documents` },
  { key: 'reminders', label: 'Reminders', icon: BellIcon, href: (id) => `/trips/${id}/reminders` },
  { key: 'travelers', label: 'Travelers', icon: UsersIcon, href: (id) => `/trips/${id}/travelers` },
  { key: 'expenses', label: 'Expenses', icon: ReceiptIcon, href: (id) => `/trips/${id}/expenses` },
  { key: 'finances', label: 'Finances', icon: WalletIcon, href: (id) => `/trips/${id}/finances` },
  { key: 'settlement', label: 'Settlement', icon: ScaleIcon, href: (id) => `/trips/${id}/settlement` },
  { key: 'deals', label: 'Deals', icon: TagIcon, href: (id) => `/trips/${id}/deals` },
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
    <nav className="sticky top-0 z-10 -mx-6 mb-2 border-b border-border bg-background/85 px-6 py-2 backdrop-blur">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href(tripId)}
              className={
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ' +
                (isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
