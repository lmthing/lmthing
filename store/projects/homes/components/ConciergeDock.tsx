import React, { useEffect, useState } from 'react';
import { Chat } from '@app/runtime';
import { ChatIcon, XIcon, SparklesIcon } from './icons';

const STORAGE_KEY = 'homes.concierge.open';

// The app-wide concierge dock — a persistent, collapsible right-side panel that
// talks to concierge/concierge, available on every page (mirrors the studio THING
// dock). Remembers open/closed; on small screens it becomes a full-screen sheet.
export function ConciergeDock() {
  const [open, setOpen] = useState(false);

  // Restore last state on mount (client only).
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        aria-label="Open the homes concierge"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90"
      >
        <SparklesIcon className="h-4 w-4" />
        Concierge
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end sm:inset-auto sm:bottom-5 sm:right-5"
      role="dialog"
      aria-label="Homes concierge"
    >
      {/* Mobile scrim */}
      <div
        className="absolute inset-0 bg-foreground/20 sm:hidden"
        onClick={() => toggle(false)}
        aria-hidden
      />
      <div className="relative flex h-full w-full flex-col overflow-hidden border border-border bg-card shadow-xl sm:h-[min(34rem,80vh)] sm:w-[24rem] sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ChatIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Concierge</span>
          </div>
          <button
            type="button"
            onClick={() => toggle(false)}
            aria-label="Close concierge"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          Drive the whole app — “what needs my attention?”, “shortlist everything over 80 under
          budget”, “pause my Berlin search”.
        </p>
        <div className="min-h-0 flex-1">
          <Chat agent="concierge/concierge" />
        </div>
      </div>
    </div>
  );
}
