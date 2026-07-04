import React, { useState } from 'react';
import { useApi, useApiMutation, apiCall, Link, navigate } from '@app/runtime';
import type { CollectionLike } from '../../components/CollectionCard';
import { Spinner } from '../../components/Spinner';

interface CollectionItem {
  id: string;
  articleId: string;
  note?: string;
  article?: { id: string; title: string };
}

type CollectionDetail = CollectionLike & { items?: CollectionItem[] };

export default function CollectionDetail({ params }: { params: { collectionId: string } }) {
  const { collectionId } = params;
  const {
    data: collection,
    isLoading,
    error,
    refetch,
  } = useApi<CollectionDetail>('getCollection', { id: collectionId });

  const updateCollection = useApiMutation<CollectionLike>('updateCollection', {
    invalidates: ['getCollection'],
  });
  const removeCollection = useApiMutation<{ ok: boolean }>('removeCollection', {
    invalidates: ['listCollections'],
  });
  const removeItem = useApiMutation<{ ok: boolean }>('removeCollectionItem', {
    invalidates: ['getCollection'],
  });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [requestingBriefing, setRequestingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const startEdit = () => {
    setTitle(collection?.title ?? '');
    setEditing(true);
  };

  const onSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await updateCollection.mutate({ id: collectionId, title: title.trim() });
      setEditing(false);
    } catch {
      // error surfaced below via updateCollection.error
    }
  };

  const onTogglePinned = async () => {
    try {
      await updateCollection.mutate({ id: collectionId, pinned: !collection?.pinned });
    } catch {
      // ignore — non-critical action
    }
  };

  const onDelete = async () => {
    try {
      await removeCollection.mutate({ id: collectionId });
      navigate('/collections');
    } catch {
      // error surfaced below via removeCollection.error
    }
  };

  const onCommissionBriefing = async () => {
    if (!collection) return;
    setRequestingBriefing(true);
    setBriefingError(null);
    try {
      await apiCall('requestBriefing', { topic: collection.title, collectionId });
      navigate('/briefings');
    } catch (err) {
      setBriefingError((err as { message?: string })?.message ?? 'Failed to commission briefing.');
    } finally {
      setRequestingBriefing(false);
    }
  };

  if (isLoading) return <Spinner />;

  if (error || !collection) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load collection.
        </div>
      </main>
    );
  }

  const items = collection.items ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/collections" className="text-sm text-muted-foreground hover:text-primary">
          ← All collections
        </Link>

        <div className="mt-2 flex items-start justify-between gap-2">
          {editing ? (
            <form onSubmit={onSaveTitle} className="flex flex-1 gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
              <button
                type="submit"
                disabled={updateCollection.isPending || !title.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <h1 className="text-xl font-bold text-foreground">{collection.title}</h1>
          )}
        </div>

        {collection.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{collection.description}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              Rename
            </button>
          ) : null}
          <button
            type="button"
            disabled={updateCollection.isPending}
            onClick={onTogglePinned}
            className={
              collection.pinned
                ? 'rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50'
                : 'rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50'
            }
          >
            {collection.pinned ? '★ Pinned' : '☆ Pin'}
          </button>
          <button
            type="button"
            disabled={removeCollection.isPending}
            onClick={onDelete}
            className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-muted disabled:opacity-50"
          >
            {removeCollection.isPending ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            disabled={requestingBriefing}
            onClick={onCommissionBriefing}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {requestingBriefing ? 'Commissioning…' : 'Commission a briefing on this collection'}
          </button>
        </div>

        {updateCollection.error ? (
          <p className="mt-2 text-sm text-destructive">
            {(updateCollection.error as { message?: string })?.message ?? 'Failed to update collection.'}
          </p>
        ) : null}
        {removeCollection.error ? (
          <p className="mt-2 text-sm text-destructive">
            {(removeCollection.error as { message?: string })?.message ?? 'Failed to delete collection.'}
          </p>
        ) : null}
        {briefingError ? <p className="mt-2 text-sm text-destructive">{briefingError}</p> : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Items</h2>

        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No items in this collection.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/feed/${item.articleId}`}
                    className="font-bold text-foreground hover:text-primary"
                  >
                    {item.article?.title ?? 'Untitled article'}
                  </Link>
                  {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
                </div>
                <button
                  type="button"
                  disabled={removeItem.isPending}
                  onClick={() => removeItem.mutate({ id: item.id })}
                  className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {removeItem.error ? (
          <p className="text-sm text-destructive">
            {(removeItem.error as { message?: string })?.message ?? 'Failed to remove item.'}
          </p>
        ) : null}
      </section>
    </main>
  );
}
