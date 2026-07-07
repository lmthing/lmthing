import React from 'react';
import { Link } from '@app/runtime';
import {
  HomeIcon,
  CalendarIcon,
  SparklesIcon,
  CompassIcon,
  MapPinIcon,
  LuggageIcon,
  RouteIcon,
  FileIcon,
  BellIcon,
  UsersIcon,
  ReceiptIcon,
  WalletIcon,
  ScaleIcon,
  TagIcon,
  ChatIcon,
} from './icons';

type TabIcon = ({ className }: { className?: string }) => React.ReactElement;

export type TripTabKey =
  | 'overview'
  | 'timeline'
  | 'plan'
  | 'research'
  | 'map'
  | 'packing'
  | 'logistics'
  | 'documents'
  | 'reminders'
  | 'travelers'
  | 'expenses'
  | 'finances'
  | 'deals'
  | 'settlement'
  | 'assistant';

interface Tab {
  key: TripTabKey;
  label: string;
  icon: TabIcon;
  href: (tripId: string) => string;
}

interface Group {
  id: string;
  label: string;
  tabs: Tab[];
}

// Three clusters replace the flat 11-tab bar. Eleven equal tabs implied eleven
// equal priorities; this groups them and makes each trip's landing the Overview.
const GROUPS: Group[] = [
  {
    id: 'plan',
    label: 'Plan',
    tabs: [
      { key: 'overview', label: 'Overview', icon: HomeIcon, href: (id) => `/trips/${id}` },
      { key: 'timeline', label: 'Timeline', icon: CalendarIcon, href: (id) => `/trips/${id}/timeline` },
      { key: 'plan', label: 'Plan', icon: SparklesIcon, href: (id) => `/trips/${id}/plan` },
      { key: 'research', label: 'Research', icon: CompassIcon, href: (id) => `/trips/${id}/research` },
      { key: 'map', label: 'Map', icon: MapPinIcon, href: (id) => `/trips/${id}/map` },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics',
    tabs: [
      { key: 'packing', label: 'Packing', icon: LuggageIcon, href: (id) => `/trips/${id}/packing` },
      { key: 'logistics', label: 'Transit', icon: RouteIcon, href: (id) => `/trips/${id}/logistics` },
      { key: 'documents', label: 'Documents', icon: FileIcon, href: (id) => `/trips/${id}/documents` },
      { key: 'reminders', label: 'Reminders', icon: BellIcon, href: (id) => `/trips/${id}/reminders` },
    ],
  },
  {
    id: 'money',
    label: 'People & Money',
    tabs: [
      { key: 'travelers', label: 'Travelers', icon: UsersIcon, href: (id) => `/trips/${id}/travelers` },
      { key: 'expenses', label: 'Expenses', icon: ReceiptIcon, href: (id) => `/trips/${id}/expenses` },
      { key: 'finances', label: 'Finances', icon: WalletIcon, href: (id) => `/trips/${id}/finances` },
      { key: 'settlement', label: 'Settlement', icon: ScaleIcon, href: (id) => `/trips/${id}/settlement` },
      { key: 'deals', label: 'Deals', icon: TagIcon, href: (id) => `/trips/${id}/deals` },
    ],
  },
];

function groupOf(active: TripTabKey): Group {
  return GROUPS.find((g) => g.tabs.some((t) => t.key === active)) ?? GROUPS[0]!;
}

export function TripTabs({ tripId, active }: { tripId: string; active: TripTabKey }) {
  const activeGroup = groupOf(active);

  return (
    <nav
      className="sticky top-0 z-10 -mx-6 mb-2 space-y-2 border-b border-border bg-background/85 px-6 py-2 backdrop-blur"
      aria-label="Trip sections"
    >
      {/* Primary: the three group segments + the copilot entry. */}
      <div className="flex items-center gap-2">
        <div role="tablist" className="flex flex-1 gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {GROUPS.map((group) => {
            const isActive = group.id === activeGroup.id;
            return (
              <Link
                key={group.id}
                href={group.tabs[0]!.href(tripId)}
                role="tab"
                aria-selected={isActive}
                className={
                  'flex-1 shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm transition-colors ' +
                  (isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {group.label}
              </Link>
            );
          })}
        </div>
        <Link
          href={`/trips/${tripId}/assistant`}
          className={
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm ' +
            (active === 'assistant'
              ? 'bg-primary text-primary-foreground'
              : 'border border-border text-foreground hover:bg-muted')
          }
        >
          <ChatIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Copilot</span>
        </Link>
      </div>

      {/* Secondary: the active group's tabs. */}
      <div role="tablist" className="flex gap-1 overflow-x-auto pb-0.5">
        {activeGroup.tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href(tripId)}
              role="tab"
              aria-selected={isActive}
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
