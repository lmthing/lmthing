import React, { useState } from 'react';
import type { Recipe } from '@app/types';
import { useApi } from '@app/runtime';
import { X, Utensils } from './icons';
import { Spinner } from './Spinner';

/**
 * A modal recipe picker used to fill an empty week-grid slot. Lists the recipe box with a quick
 * name filter; picking one calls `onPick(recipeId)`.
 */
export function RecipePicker({
  open,
  title,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  onPick: (recipeId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const { data: recipes, isLoading } = useApi<Recipe[]>('listRecipes', {}, { enabled: open });

  if (!open) return null;

  const list = (recipes ?? []).filter(
    (r) =>
      r.title !== 'Importing…' &&
      r.title !== 'Import failed' &&
      r.title.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes…"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {isLoading ? <Spinner /> : null}
          {!isLoading && list.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No recipes match.</p>
          ) : null}
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-left hover:border-primary/40"
            >
              {r.imageUrl ? (
                <img src={r.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Utensils className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.prepMinutes ?? 30} min
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RecipePicker;
