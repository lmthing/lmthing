import React from 'react';
import type { TravelerPreference } from '@app/types';

export function PreferenceRow({
  preference,
  onRemove,
}: {
  preference: TravelerPreference;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 space-y-0.5">
        <span className="mr-2 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {preference.category}
        </span>
        <span className="text-foreground">{preference.value}</span>
        {preference.notes ? (
          <p className="text-sm text-muted-foreground">{preference.notes}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-muted-foreground">weight {preference.weight.toFixed(1)}</span>
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(preference.id)}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
