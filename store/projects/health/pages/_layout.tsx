import React from 'react';
import { Link, resolveAppBase } from '@app/runtime';
import { Disclaimer } from '../components/Disclaimer';
import { AssistantDock } from '../components/AssistantDock';
import {
  HomeIcon,
  HeartIcon,
  PillIcon,
  CalendarIcon,
  TargetIcon,
  FileIcon,
  SettingsIcon,
} from '../components/icons';

interface SubItem {
  to: string;
  label: string;
}
interface Section {
  id: string;
  label: string;
  to: string;
  icon: (p: { className?: string }) => React.ReactElement;
  items: SubItem[];
}

// 17 flat pills → 6 sections, each mapping to the space that owns the area.
const SECTIONS: Section[] = [
  { id: 'today', label: 'Today', to: '/', icon: HomeIcon, items: [] },
  {
    id: 'vitals',
    label: 'Vitals',
    to: '/labs',
    icon: HeartIcon,
    items: [
      { to: '/labs', label: 'Labs' },
      { to: '/symptoms', label: 'Symptoms' },
      { to: '/insights', label: 'Insights' },
    ],
  },
  {
    id: 'meds',
    label: 'Meds',
    to: '/medications',
    icon: PillIcon,
    items: [
      { to: '/medications', label: 'Medications' },
      { to: '/doses', label: 'Doses' },
      { to: '/interactions', label: 'Interactions' },
    ],
  },
  {
    id: 'care',
    label: 'Care',
    to: '/appointments',
    icon: CalendarIcon,
    items: [
      { to: '/appointments', label: 'Appointments' },
      { to: '/visits', label: 'Visits' },
      { to: '/triage', label: 'Triage' },
      { to: '/contacts', label: 'Care team' },
      { to: '/shares', label: 'Care shares' },
    ],
  },
  {
    id: 'goals',
    label: 'Goals',
    to: '/goals',
    icon: TargetIcon,
    items: [
      { to: '/goals', label: 'Goals' },
      { to: '/followups', label: 'Follow-ups' },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    to: '/documents',
    icon: FileIcon,
    items: [
      { to: '/documents', label: 'Documents' },
      { to: '/knowledge', label: 'Knowledge' },
    ],
  },
];

/** The current route relative to the app base (`/labs`, `/labs/…`, `/`). */
function useClientPath(): string {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const base = resolveAppBase(pathname);
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.length > 0 ? rest : '/';
}

function matchesSection(current: string, section: Section): boolean {
  if (section.id === 'today') return current === '/';
  const routes = section.items.length ? section.items.map((i) => i.to) : [section.to];
  return routes.some((r) => current === r || current.startsWith(`${r}/`));
}

function isSubActive(current: string, to: string): boolean {
  return current === to || current.startsWith(`${to}/`);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const current = useClientPath();
  const activeSection = SECTIONS.find((s) => matchesSection(current, s)) ?? SECTIONS[0];
  const subItems = activeSection.items;

  return (
    <div className="min-h-screen bg-background pb-16 text-foreground sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        {/* Primary section bar */}
        <nav className="mx-auto flex max-w-5xl items-center gap-x-1 px-4 py-2.5 sm:px-6">
          <Link
            href="/"
            className="mr-2 flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground hover:opacity-80"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            lmthing<span className="text-primary">.health</span>
          </Link>

          {/* Desktop primary sections */}
          <div className="hidden flex-1 items-center gap-1 sm:flex">
            {SECTIONS.map((s) => {
              const active = s.id === activeSection.id;
              return (
                <Link
                  key={s.id}
                  href={s.to}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                      : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <AssistantDock />
            <Link
              href="/settings"
              aria-current={current === '/settings' ? 'page' : undefined}
              aria-label="Settings"
              className={
                current === '/settings'
                  ? 'inline-flex items-center rounded-full bg-primary p-2 text-primary-foreground'
                  : 'inline-flex items-center rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
          </div>
        </nav>

        {/* Secondary contextual sub-nav (only when the active section has children) */}
        {subItems.length > 0 ? (
          <div className="border-t border-border bg-background/60">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2 sm:px-6">
              {subItems.map((item) => {
                const active = isSubActive(current, item.to);
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground'
                        : 'inline-flex items-center rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto max-w-4xl px-6 pt-4">
        <Disclaimer />
      </div>
      {children}

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-card/95 backdrop-blur sm:hidden"
        aria-label="Sections"
      >
        {SECTIONS.map((s) => {
          const active = s.id === activeSection.id;
          return (
            <Link
              key={s.id}
              href={s.to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <s.icon className="h-5 w-5" />
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
