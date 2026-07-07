import React, { useState } from 'react';
import { Chat, Link } from '@app/runtime';
import { ChatIcon, SparkleIcon } from './icons';

/**
 * The app-wide Health Assistant surface. A header "Ask" button toggles a right-side
 * slide-over (desktop) / near-full-height sheet (mobile) hosting the care/assistant
 * <Chat> dock — the single conversational front door to the whole record.
 *
 * Rendered once in _layout so it is reachable from every page. Confirm-before-write
 * and clinical routing are enforced by the agent's charter + capabilities.
 */
export function AssistantDock() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the Health Assistant"
        className="inline-flex items-center gap-1.5 rounded-full bg-agent px-3 py-1.5 text-sm font-medium text-agent-foreground hover:opacity-90"
      >
        <SparkleIcon className="h-4 w-4" />
        Ask
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Health Assistant">
          <button
            type="button"
            aria-label="Close assistant"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-agent">
                  <ChatIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">Health Assistant</p>
                  <p className="text-xs text-muted-foreground">Navigate, log, and ask across your record</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href="/assistant"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Full screen
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              Confirms before changing anything · routes clinical questions to the specialists · not medical advice
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <Chat agent="care/assistant" />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export default AssistantDock;
