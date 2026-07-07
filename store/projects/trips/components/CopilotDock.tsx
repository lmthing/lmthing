import React, { useState } from 'react';
import { Chat, Link } from '@app/runtime';
import { ChatIcon, XIcon, SparklesIcon } from './icons';

// The Trip Copilot dock — a collapsible, write-capable chat available on the
// trip's hero pages (Overview / Timeline). Desktop: a floating right-rail panel;
// small screens: a full-screen sheet. Backed by the `copilot/assistant` agent,
// which can add expenses, split them, add travelers, generate packing, hunt
// deals, and delegate to the specialists — the app, drivable conversationally.

export function CopilotDock({ tripId, tripTitle }: { tripId: string; tripTitle?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Trip Copilot"
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90"
      >
        <SparklesIcon className="h-5 w-5" />
        Ask Copilot
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end sm:inset-auto sm:bottom-5 sm:right-5">
      <button
        type="button"
        aria-label="Close copilot"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-foreground/20 sm:hidden"
      />
      <div className="relative flex h-[85vh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-xl sm:h-[70vh] sm:w-[380px] sm:rounded-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <ChatIcon className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">Trip Copilot</p>
              {tripTitle ? (
                <p className="truncate text-xs text-muted-foreground">{tripTitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/trips/${tripId}/assistant`}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Expand
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close copilot"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Chat agent="copilot/assistant" />
        </div>
      </div>
    </div>
  );
}
