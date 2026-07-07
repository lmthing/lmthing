import React, { useEffect } from 'react';
import { Link, resolveAppBase, useApi, navigate } from '@app/runtime';
import { Icon, type IconName } from '../components/icons';
import { relativeTime } from '../components/format';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}
interface NavGroup {
  label: string;
  icon: IconName;
  /** The representative destination for the mobile bottom tab. */
  home: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: 'Read',
    icon: 'read',
    home: '/',
    items: [
      { to: '/', label: 'Feed', icon: 'feed' },
      { to: '/discover', label: 'Discover', icon: 'discover' },
      { to: '/topics', label: 'Topics', icon: 'topics' },
      { to: '/search', label: 'Search', icon: 'search' },
    ],
  },
  {
    label: 'Library',
    icon: 'library',
    home: '/collections',
    items: [
      { to: '/collections', label: 'Collections', icon: 'collections' },
      { to: '/digests', label: 'Digests', icon: 'digests' },
      { to: '/briefings', label: 'Briefings', icon: 'briefings' },
    ],
  },
  {
    label: 'Signals',
    icon: 'signals',
    home: '/alerts',
    items: [
      { to: '/alerts', label: 'Alerts', icon: 'alerts' },
      { to: '/subscriptions', label: 'Subscriptions', icon: 'subscriptions' },
      { to: '/insights', label: 'Insights', icon: 'insights' },
    ],
  },
  {
    label: 'Settings',
    icon: 'settings',
    home: '/preferences',
    items: [{ to: '/preferences', label: 'Preferences', icon: 'settings' }],
  },
];

interface Alert {
  read?: boolean;
}
interface Health {
  updatedAt?: string;
}
interface Stats {
  unread?: number;
}

/** The current route relative to the app base (`/topics`, `/feed/…`, `/`). */
function useClientPath(): string {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const base = resolveAppBase(pathname);
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.length > 0 ? rest : '/';
}

function isActive(current: string, to: string): boolean {
  if (to === '/') return current === '/';
  return current === to || current.startsWith(`${to}/`);
}

function groupActive(current: string, group: NavGroup): boolean {
  return group.items.some((i) => isActive(current, i.to));
}

function viewTitle(current: string): string {
  for (const g of GROUPS) {
    for (const i of g.items) {
      if (isActive(current, i.to)) return i.label;
    }
  }
  if (current.startsWith('/feed')) return 'Article';
  if (current.startsWith('/assistant')) return 'Editor';
  if (current.startsWith('/tag/')) return 'Tag';
  return 'lmthing.blog';
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const current = useClientPath();
  const { data: alerts } = useApi<Alert[]>('listAlerts', { unreadOnly: true });
  const { data: stats } = useApi<Stats>('feedStats', {});
  const { data: health } = useApi<Health[]>('sourceHealth', {});
  const unread = (alerts ?? []).filter((a) => a.read !== true).length;

  const lastRefresh = (health ?? [])
    .map((h) => h.updatedAt)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))[0];
  const lastRefreshRel = relativeTime(lastRefresh);
  const unreadCount = stats?.unread ?? 0;

  // ⌘K / Ctrl-K opens the Editor concierge — the command-bar on-ramp.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        navigate('/assistant');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar — context + global actions + assistant launcher */}
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground hover:opacity-80"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            lmthing<span className="text-primary">.blog</span>
          </Link>

          <span className="hidden text-sm font-medium text-muted-foreground sm:inline" aria-current="page">
            / {viewTitle(current)}
          </span>

          <div className="ml-auto flex items-center gap-3">
            {/* Newsroom activity indicator */}
            <span
              className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
              title="The newsroom fetches and synthesizes in the background"
              aria-live="polite"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {lastRefreshRel ? `Refreshed ${lastRefreshRel}` : 'Newsroom warming up'}
              {unreadCount > 0 ? <span>· {unreadCount} unread</span> : null}
            </span>

            <Link
              href="/assistant"
              aria-current={current.startsWith('/assistant') ? 'page' : undefined}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Icon name="sparkle" className="h-4 w-4" filled /> Editor
              <span className="hidden rounded bg-primary-foreground/20 px-1 text-[0.65rem] font-semibold lg:inline">
                ⌘K
              </span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl">
        {/* Desktop left rail */}
        <aside className="sticky top-[3.25rem] hidden h-[calc(100vh-3.25rem)] w-56 shrink-0 overflow-y-auto border-r border-border px-3 py-5 md:block">
          <nav className="space-y-5">
            {GROUPS.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                  <Icon name={group.icon} className="h-3.5 w-3.5" />
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const active = isActive(current, item.to);
                  const showBadge = item.to === '/alerts' && unread > 0;
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={
                        active
                          ? 'flex items-center gap-2.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground'
                          : 'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
                      }
                    >
                      <Icon name={item.icon} className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {showBadge ? (
                        <span
                          className={
                            active
                              ? 'inline-flex min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[0.65rem] font-bold text-primary'
                              : 'inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground'
                          }
                        >
                          {unread}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content — extra bottom padding on mobile for the tab bar */}
        <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card md:hidden">
        {GROUPS.map((group) => {
          const active = groupActive(current, group);
          const showBadge = group.label === 'Signals' && unread > 0;
          return (
            <Link
              key={group.label}
              href={group.home}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon name={group.icon} className="h-5 w-5" />
              {group.label}
              {showBadge ? (
                <span className="absolute right-1/4 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground">
                  {unread}
                </span>
              ) : null}
            </Link>
          );
        })}
        <Link
          href="/assistant"
          aria-current={current.startsWith('/assistant') ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] ${
            current.startsWith('/assistant') ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icon name="sparkle" className="h-5 w-5" filled />
          Editor
        </Link>
      </nav>
    </div>
  );
}
