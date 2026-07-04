import React, { useState } from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { CollectionCard, type CollectionLike } from '../../components/CollectionCard';
import { Spinner } from '../../components/Spinner';

export default function Collections() {
  const { data: collections, isLoading, error } = useApi<CollectionLike[]>('listCollections', {});

  const createCollection = useApiMutation<CollectionLike>('createCollection', {
    invalidates: ['listCollections'],
  });

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'manual' | 'smart'>('manual');
  const [tags, setTags] = useState('');

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await createCollection.mutate({
        title: title.trim(),
        kind,
        query: kind === 'smart' && tagList.length > 0 ? { tags: tagList } : undefined,
      });
      setTitle('');
      setTags('');
      setKind('manual');
    } catch {
      // error surfaced below via createCollection.error
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Collections</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">New collection</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Collection title"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'manual' | 'smart')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="manual">Manual</option>
              <option value="smart">Smart</option>
            </select>
          </div>
          {kind === 'smart' ? (
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          ) : null}
          <button
            type="submit"
            disabled={createCollection.isPending || !title.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {createCollection.isPending ? 'Creating…' : 'Create collection'}
          </button>
          {createCollection.error ? (
            <p className="text-sm text-destructive">
              {(createCollection.error as { message?: string })?.message ?? 'Failed to create collection.'}
            </p>
          ) : null}
        </form>
      </section>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load collections.
        </div>
      ) : null}

      {!isLoading && !error && (collections ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No collections yet. Create one above.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(collections ?? []).map((c) => (
          <CollectionCard key={c.id} collection={c} />
        ))}
      </div>
    </main>
  );
}
