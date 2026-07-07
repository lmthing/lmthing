import React, { useEffect, useRef, useState } from 'react';
import type { Search } from '@app/types';
import { useApi, navigate } from '@app/runtime';
import { ChevronDownIcon, CheckIcon } from './icons';

// A persistent search switcher for the nav — jump between hunts without going
// back to the list. Only rendered when the current route is inside a search.
export function SearchSwitcher({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { data: searches } = useApi<(Search & { unreadAlerts?: number })[]>('searchList', {});

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const list = searches ?? [];
  const current = list.find((s) => s.id === currentId);
  if (!current && list.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Switch search"
        className="flex max-w-[10rem] items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground hover:bg-muted sm:max-w-[16rem]"
      >
        <span className="truncate">{current?.title ?? 'Search'}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {list.map((s) => {
              const active = s.id === currentId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/searches/${s.id}`);
                  }}
                  className={
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ' +
                    (active ? 'text-foreground' : 'text-muted-foreground')
                  }
                >
                  <span className="min-w-0 truncate">{s.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {s.unreadAlerts ? (
                      <span className="rounded-full border border-primary px-1.5 text-[0.6rem] text-primary">
                        {s.unreadAlerts}
                      </span>
                    ) : null}
                    {active ? <CheckIcon className="h-4 w-4 text-primary" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
