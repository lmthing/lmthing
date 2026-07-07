import React from 'react';
import { humanizeSlug } from './format';

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
        return (
          <span
            key={flag}
            className={
              warning
                ? 'rounded-full border border-destructive px-2 py-0.5 text-xs font-medium text-destructive'
                : 'rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground'
            }
          >
            {humanizeSlug(flag)}
          </span>
        );
      })}
    </div>
  );
}
