import React from 'react';
import { Link } from '@app/runtime';
import { SparklesIcon, InboxIcon, ScaleIcon, HeartIcon } from './icons';

type TabIcon = ({ className }: { className?: string }) => React.ReactElement;
export type SearchTabKey = 'feed' | 'inbox' | 'compare' | 'taste';

const TABS: { key: SearchTabKey; label: string; icon: TabIcon; href: (id: string) => string }[] = [
  { key: 'feed', label: 'Feed', icon: SparklesIcon, href: (id) => `/searches/${id}` },
  { key: 'inbox', label: 'Inbox', icon: InboxIcon, href: (id) => `/searches/${id}/inbox` },
  { key: 'compare', label: 'Compare', icon: ScaleIcon, href: (id) => `/searches/${id}/compare` },
  { key: 'taste', label: 'Taste', icon: HeartIcon, href: (id) => `/searches/${id}/taste` },
];

export function SearchTabs({
  searchId,
  active,
  counts,
}: {
  searchId: string;
  active: SearchTabKey;
  counts?: Partial<Record<SearchTabKey, number>>;
}) {
  return (
    <nav className="sticky top-0 z-10 -mx-4 mb-2 border-b border-border bg-background/85 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          const count = counts?.[tab.key];
          return (
            <Link
              key={tab.key}
              href={tab.href(searchId)}
              className={
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ' +
                (isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground')
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {typeof count === 'number' && count > 0 ? (
                <span
                  className={
                    'rounded-full px-1.5 text-[0.65rem] font-semibold ' +
                    (isActive ? 'bg-primary-foreground/20' : 'bg-muted text-foreground')
                  }
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
