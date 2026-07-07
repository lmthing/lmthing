import React, { useEffect, useState } from 'react';
import { Chat } from '@app/runtime';
import { Sparkles, X } from './icons';

/**
 * The app-wide Kitchen Concierge dock. A floating launcher (bottom-right on desktop) opens a
 * slide-over panel with a live `<Chat agent="chef/concierge" />` — one conversational surface that
 * can drive the whole app (plan a week, swap a meal, update the pantry, build a shop trip…),
 * unlike the page-bound `<Chat>` widgets. Anything can open it by dispatching the
 * `kitchen:open-concierge` window event (e.g. the onboarding "Ask the chef" CTA, the mobile nav).
 */
export function openConcierge(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kitchen:open-concierge'));
  }
}

export function ConciergeDock() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('kitchen:open-concierge', onOpen);
    return () => window.removeEventListener('kitchen:open-concierge', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask the chef"
          className="fixed bottom-5 right-5 z-30 hidden items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90 sm:inline-flex"
        >
          <Sparkles className="h-4 w-4" />
          Ask the chef
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-foreground/40"
          role="dialog"
          aria-modal="true"
          aria-label="Kitchen concierge"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                Kitchen concierge
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <Chat agent="chef/concierge" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ConciergeDock;
