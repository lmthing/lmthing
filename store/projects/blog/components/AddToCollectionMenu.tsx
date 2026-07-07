import React, { useState } from 'react';
import { useApi, apiCall } from '@app/runtime';
import type { CollectionLike } from './CollectionCard';

export function AddToCollectionMenu({ articleId }: { articleId: string }) {
  const { data: collections, isLoading } = useApi<CollectionLike[]>('listCollections', {});
  const [open, setOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onAdd = async (collectionId: string) => {
    setPendingId(collectionId);
    setError(null);
    try {
      await apiCall('addToCollection', { id: collectionId, articleId });
      setAddedIds((ids) => (ids.includes(collectionId) ? ids : [...ids, collectionId]));
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Could not add to that collection.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        + Add to collection
      </button>

      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-64 space-y-1 rounded-lg border border-border bg-card p-2 shadow-lg">
          {isLoading ? <p className="p-2 text-sm text-muted-foreground">Loading…</p> : null}
          {!isLoading && (collections ?? []).length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No collections yet.</p>
          ) : null}
          {(collections ?? []).map((c) => {
            const added = addedIds.includes(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                <span className="truncate text-sm text-foreground">{c.title}</span>
                <button
                  type="button"
                  disabled={pendingId === c.id || added}
                  onClick={() => onAdd(c.id)}
                  className={
                    added
                      ? 'shrink-0 rounded-md border border-success px-2 py-0.5 text-xs text-success'
                      : 'shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50'
                  }
                >
                  {added ? '✓ Added' : pendingId === c.id ? 'Adding…' : 'Add'}
                </button>
              </div>
            );
          })}
          {error ? <p className="px-2 py-1 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
