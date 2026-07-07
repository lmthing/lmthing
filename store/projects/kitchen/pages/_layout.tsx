import React from 'react';
import { Link, resolveAppBase } from '@app/runtime';
import {
  Flame,
  BookOpen,
  ShoppingCart,
  Activity,
  Settings,
  Sparkles,
  Package,
} from '../components/icons';
import { ConciergeDock, openConcierge } from '../components/ConciergeDock';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof Flame;
}

/** Four task-shaped destinations: the real kitchen loop is Plan → Shop → Cook → Track. */
const NAV: NavItem[] = [
  { to: '/', label: 'Cook', Icon: Flame },
  { to: '/recipes', label: 'Recipes', Icon: BookOpen },
  { to: '/shop', label: 'Shop', Icon: ShoppingCart },
  { to: '/insights', label: 'Insights', Icon: Activity },
];

/** The current route relative to the app base (`/recipes`, `/recipes/…`, `/`). */
function useClientPath(): string {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const base = resolveAppBase(pathname);
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.length > 0 ? rest : '/';
}

function isActive(current: string, to: string): boolean {
  if (to === '/') return current === '/';
  if (to === '/shop')
    return current.startsWith('/shop') || current.startsWith('/shopping') || current.startsWith('/trip');
  if (to === '/insights')
    return current.startsWith('/insights') || current.startsWith('/nutrition') || current.startsWith('/expiring');
  return current === to || current.startsWith(`${to}/`);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const current = useClientPath();

  return (
    <div className="min-h-screen bg-background pb-16 text-foreground sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <nav
          aria-label="Primary"
          className="mx-auto flex max-w-5xl items-center gap-x-1 px-4 py-2.5 sm:px-6"
        >
          <Link
            href="/"
            className="mr-2 flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground hover:opacity-80"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            lmthing<span className="text-primary">.kitchen</span>
          </Link>

          {/* Primary destinations — hidden on phones, where the bottom bar takes over. */}
          <div className="hidden flex-1 items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active = isActive(current, item.to);
              const Icon = item.Icon;
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                      : 'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <button
              type="button"
              onClick={openConcierge}
              aria-label="Ask the chef"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <Link
              href="/pantry"
              aria-label="Pantry"
              aria-current={current.startsWith('/pantry') ? 'page' : undefined}
              className={
                current.startsWith('/pantry')
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-sm text-foreground'
                  : 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            >
              <Package className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/preferences"
              aria-label="Preferences"
              aria-current={current.startsWith('/preferences') ? 'page' : undefined}
              className={
                current.startsWith('/preferences')
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-sm text-foreground'
                  : 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            >
              <Settings className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </nav>
      </header>

      {children}

      {/* Mobile bottom tab bar. */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur sm:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(current, item.to);
          const Icon = item.Icon;
          return (
            <Link
              key={item.to}
              href={item.to}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium text-primary'
                  : 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] text-muted-foreground'
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={openConcierge}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] text-muted-foreground"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          Ask
        </button>
      </nav>

      <ConciergeDock />
    </div>
  );
}
