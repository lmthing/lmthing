import React, { useState } from 'react';
import { useApi, apiCall } from '@app/runtime';
import type { CollectionLike } from './CollectionCard';

export function AddToCollectionMenu({ articleId }: { articleId: string }) {
  const { data: collections, isLoading } = useApi<CollectionLike[]>('listCollections', {});
  const [open, setOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onAdd = async (collectionId: string) => {
    setPendingId(collectionId);
    try {
      await apiCall('addToCollection', { id: collectionId, articleId });
      setAddedId(collectionId);
    } catch {
      // ignore — non-critical action
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
          {(collections ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <span className="truncate text-sm text-foreground">{c.title}</span>
              <button
                type="button"
                disabled={pendingId === c.id}
                onClick={() => onAdd(c.id)}
                className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
              >
                {addedId === c.id ? 'Added' : pendingId === c.id ? 'Adding…' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
