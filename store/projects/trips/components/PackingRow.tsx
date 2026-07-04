import React from 'react';
import type { PackingItem } from '@app/types';
import { useApiMutation } from '@app/runtime';

export function PackingRow({ item }: { item: PackingItem }) {
  const togglePacked = useApiMutation<PackingItem>('togglePacked', {
    invalidates: ['packingList'],
  });
  const removePackingItem = useApiMutation<{ ok: boolean }>('removePackingItem', {
    invalidates: ['packingList'],
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
      <label className="flex min-w-0 items-center gap-3">
        <input
          type="checkbox"
          checked={item.packed}
          onChange={(e) => togglePacked.mutate({ id: item.id, packed: e.target.checked })}
          disabled={togglePacked.isPending}
          className="h-4 w-4 shrink-0"
        />
        <span className="min-w-0 space-y-0.5">
          <span
            className={
              item.packed
                ? 'block line-through text-muted-foreground'
                : 'block text-foreground'
            }
          >
            {item.label}
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {item.category}
            </span>
            {item.reason ? (
              <span className="text-xs text-muted-foreground">{item.reason}</span>
            ) : null}
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={() => removePackingItem.mutate({ id: item.id })}
        disabled={removePackingItem.isPending}
        className="shrink-0 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
