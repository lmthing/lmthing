import React from 'react';

/**
 * A compact one-line summary card — "N labs flagged · M active symptoms" — shown at the top of
 * the interpreter's morning digest or an appointment-prep brief, before the detail below it.
 */
export function FlagSummary({ flagged, active }: { flagged: number; active: number }) {
  return (
    <div className="rounded-md border border-border bg-muted p-3">
      <p className="text-sm font-semibold text-foreground">
        {flagged} lab{flagged === 1 ? '' : 's'} flagged · {active} active symptom{active === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export default FlagSummary;
