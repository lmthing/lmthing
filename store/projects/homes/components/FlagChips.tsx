import React from 'react';
import { humanizeSlug } from './format';
import { AlertTriangleIcon } from './icons';

// Hard warning flags — things that should give the user real pause.
// Everything else is a softer, informational condition flag.
const WARNING_FLAGS = new Set([
  'size_overstated',
  'photo_text_mismatch',
  'possible_duplicate',
  'scam_signals',
]);

export function FlagChips({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => {
        const warning = WARNING_FLAGS.has(flag);
        const label = humanizeSlug(flag);
        return (
          <span
            key={flag}
            // Pair the token color with an icon + word so a color-only signal
            // never fails a colorblind reader.
            aria-label={warning ? `Warning: ${label}` : label}
            className={
              warning
                ? 'inline-flex items-center gap-1 rounded-full border border-destructive px-2 py-0.5 text-xs font-medium text-destructive'
                : 'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
            }
          >
            {warning ? <AlertTriangleIcon className="h-3 w-3" /> : null}
            {label}
          </span>
        );
      })}
    </div>
  );
}
