import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Utensils } from './icons';

/**
 * A full-screen, step-by-step cooking view for a phone-in-hand context: large type, one step at a
 * time, swipe/tap between steps, and a screen wake-lock so the screen doesn't sleep mid-cook. Steps
 * are parsed from the recipe's markdown instructions (numbered lines first, then paragraphs).
 */
function parseSteps(instructions: string): string[] {
  const text = (instructions ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const numbered = lines
    .map((l) => l.match(/^(\d+)[.)]\s+(.*)$/))
    .filter(Boolean)
    .map((m) => (m as RegExpMatchArray)[2]);
  if (numbered.length >= 2) return numbered;
  // Fall back to bullet lines, then to sentence-ish paragraphs.
  const bullets = lines.filter((l) => l.startsWith('- ') || l.startsWith('* ')).map((l) => l.slice(2));
  if (bullets.length >= 2) return bullets;
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.length ? sentences : [text];
}

export function CookingMode({
  title,
  instructions,
  open,
  onClose,
  onMarkCooked,
  cooked,
}: {
  title: string;
  instructions: string;
  open: boolean;
  onClose: () => void;
  onMarkCooked?: () => void;
  cooked?: boolean;
}) {
  const steps = useMemo(() => parseSteps(instructions), [instructions]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // Best-effort screen wake-lock while cooking; released on close/unmount. No-op where unsupported.
  useEffect(() => {
    if (!open) return;
    let lock: { release: () => void } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<any> } };
    if (nav.wakeLock?.request) {
      nav.wakeLock
        .request('screen')
        .then((l: any) => {
          lock = l;
        })
        .catch(() => {});
    }
    return () => {
      try {
        lock?.release();
      } catch {
        /* ignore */
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(steps.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length, onClose]);

  if (!open) return null;

  const atEnd = i >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Cooking ${title}`}>
      <div className="flex items-center justify-between border-b border-border p-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Utensils className="h-4 w-4 text-primary" />
          <span className="truncate">{title}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit cooking mode"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Step {i + 1} of {steps.length}
        </span>
        <p className="max-w-2xl text-2xl font-medium leading-relaxed text-foreground sm:text-3xl">
          {steps[i]}
        </p>
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex gap-1">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={idx <= i ? 'h-1 flex-1 rounded-full bg-primary' : 'h-1 flex-1 rounded-full bg-muted'}
              aria-hidden
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          {atEnd ? (
            onMarkCooked && !cooked ? (
              <button
                type="button"
                onClick={() => {
                  onMarkCooked();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Check className="h-4 w-4" /> Done — mark cooked
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Check className="h-4 w-4" /> Finish
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CookingMode;
