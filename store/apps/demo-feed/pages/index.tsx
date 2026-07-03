import React, { useState } from 'react';
import { useApi, useApiMutation } from '@app/runtime';

interface FeedItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  read: boolean;
  createdAt: string;
}

interface FeedListOutput {
  items: FeedItem[];
}

export default function Feed() {
  const { data, isLoading, error } = useApi<FeedListOutput>('feedList', {});

  const addItem = useApiMutation<FeedItem>('addItem', {
    invalidates: ['feedList'],
  });
  const markRead = useApiMutation<{ ok: boolean }>('markRead', {
    invalidates: ['feedList'],
  });

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');

  const items = data?.items ?? [];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addItem.mutate({ title, url, summary });
    setTitle('');
    setUrl('');
    setSummary('');
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Personal Feed</h1>
        <p className="text-sm text-muted-foreground">
          A hand-authored reference app — add a link, then mark it read.
        </p>
      </header>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <label className="text-sm text-foreground" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What did you read?"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-foreground" htmlFor="url">
            URL
          </label>
          <input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-foreground" htmlFor="summary">
            Summary
          </label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-paragraph summary…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            rows={2}
          />
        </div>

        <button
          type="submit"
          disabled={addItem.isPending || !title.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {addItem.isPending ? 'Adding…' : 'Add item'}
        </button>

        {addItem.error ? (
          <p className="text-sm text-destructive">{addItem.error.message}</p>
        ) : null}
      </form>

      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load feed.
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No items yet — add one above.
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-medium text-foreground">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h2>
                {item.summary ? (
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                ) : null}
              </div>

              {item.read ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Read
                </span>
              ) : (
                <button
                  type="button"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate({ id: item.id })}
                  className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
