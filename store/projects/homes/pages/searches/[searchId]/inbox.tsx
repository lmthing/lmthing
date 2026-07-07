import React, { useEffect, useState } from 'react';
import type { Search, RawCapture, Source } from '@app/types';
import { useApi, useApiMutation, apiCall, Chat } from '@app/runtime';
import { SearchTabs } from '../../../components/SearchTabs';
import { CaptureRow } from '../../../components/CaptureRow';
import { Spinner } from '../../../components/Spinner';
import { formatDateTime } from '../../../components/format';

const SOURCE_KINDS = ['alert_email', 'saved_search', 'pasted_link', 'manual'];

type SearchWithSources = Search & { sources: Source[] };

export default function SearchInbox({ params }: { params: { searchId: string } }) {
  const { searchId } = params;

  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const [showAddSource, setShowAddSource] = useState(false);
  const [srcKind, setSrcKind] = useState('saved_search');
  const [srcLabel, setSrcLabel] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcNotes, setSrcNotes] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);

  const [polling, setPolling] = useState(true);

  const {
    data: search,
    isLoading: searchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useApi<SearchWithSources>('getSearch', { id: searchId });

  const {
    data: captures,
    isLoading,
    error,
  } = useApi<RawCapture[]>(
    'listCaptures',
    { id: searchId },
    { refetchInterval: polling ? 3000 : undefined },
  );

  useEffect(() => {
    setPolling((captures ?? []).some((c) => c.status === 'pending' || c.status === 'parsing'));
  }, [captures]);

  const ingestCapture = useApiMutation<{ captureId: string; status: string }>('ingestCapture', {
    invalidates: ['listCaptures'],
  });
  const updateSource = useApiMutation<Source>('updateSource', { invalidates: ['getSearch'] });
  const pollSource = useApiMutation<{ ok: boolean }>('pollSource', { invalidates: ['getSearch'] });

  const onIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await ingestCapture.mutate({
        id: searchId,
        content: content.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
      });
      setContent('');
      setSourceUrl('');
    } catch {
      // surfaced via ingestCapture.error below
    }
  };

  const onAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srcLabel.trim()) return;
    setAddingSource(true);
    setAddSourceError(null);
    try {
      await apiCall('addSource', {
        id: searchId,
        kind: srcKind,
        label: srcLabel.trim(),
        url: srcUrl.trim() || undefined,
        notes: srcNotes.trim() || undefined,
      });
      setSrcLabel('');
      setSrcUrl('');
      setSrcNotes('');
      setShowAddSource(false);
      refetchSearch();
    } catch (e2) {
      setAddSourceError((e2 as { message?: string })?.message ?? 'Could not add source.');
    } finally {
      setAddingSource(false);
    }
  };

  const sources = search?.sources ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <SearchTabs searchId={searchId} active="inbox" />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Capture desk</h1>
        <p className="text-sm text-muted-foreground">
          Paste anything — an alert email, a saved-search page, a bare link. The clipper cleans it
          into comparable listings.
        </p>
      </div>

      <form onSubmit={onIngest} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="content">
            Paste here
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            placeholder="Paste the alert email body, saved-search results page, or a listing link…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="sourceUrl">
            Source URL (optional)
          </label>
          <input
            id="sourceUrl"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        {ingestCapture.error ? (
          <p className="text-sm text-destructive">
            {(ingestCapture.error as { message?: string })?.message ?? 'Failed to ingest.'}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={ingestCapture.isPending || !content.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {ingestCapture.isPending ? 'Sending to the clipper…' : 'Ingest'}
        </button>
      </form>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Sources
          </h2>
          <button
            type="button"
            onClick={() => setShowAddSource((v) => !v)}
            className="text-sm text-primary hover:underline"
          >
            + Add source
          </button>
        </div>

        {showAddSource ? (
          <form
            onSubmit={onAddSource}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="srcKind">
                Kind
              </label>
              <select
                id="srcKind"
                value={srcKind}
                onChange={(e) => setSrcKind(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {SOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="srcLabel">
                Label
              </label>
              <input
                id="srcLabel"
                value={srcLabel}
                onChange={(e) => setSrcLabel(e.target.value)}
                placeholder="Idealista daily alert"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="min-w-[160px] flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="srcUrl">
                URL (for polling)
              </label>
              <input
                id="srcUrl"
                value={srcUrl}
                onChange={(e) => setSrcUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="srcNotes">
                Notes
              </label>
              <input
                id="srcNotes"
                value={srcNotes}
                onChange={(e) => setSrcNotes(e.target.value)}
                placeholder="Anything the clipper should know"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={addingSource || !srcLabel.trim()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
            {addSourceError ? (
              <p className="w-full text-sm text-destructive">{addSourceError}</p>
            ) : null}
          </form>
        ) : null}

        {searchLoading ? <Spinner label="Loading sources…" /> : null}
        {searchError ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load sources.
          </div>
        ) : null}

        {!searchLoading && sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sources yet — paste something above, or add one.
          </p>
        ) : null}

        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {s.kind}
                  </span>
                </div>
                {s.kind === 'saved_search' ? (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!s.pollEnabled}
                        onChange={(e) =>
                          updateSource.mutate({ id: s.id, pollEnabled: e.target.checked })
                        }
                        disabled={updateSource.isPending}
                      />
                      Poll every {s.pollIntervalHours}h
                    </label>
                    <button
                      type="button"
                      onClick={() => pollSource.mutate({ id: s.id })}
                      disabled={pollSource.isPending || !s.url}
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Check now
                    </button>
                  </div>
                ) : null}
              </div>
              {s.url ? <p className="truncate text-xs text-muted-foreground">{s.url}</p> : null}
              {s.blockedReason ? (
                <p className="text-xs text-destructive">Polling paused: {s.blockedReason}</p>
              ) : null}
              {s.lastPolledAt ? (
                <p className="text-xs text-muted-foreground">
                  Last checked {formatDateTime(s.lastPolledAt)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Captures
        </h2>

        {isLoading ? <Spinner label="Loading captures…" /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load captures.
          </div>
        ) : null}

        {!isLoading && !error && (captures ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No captures yet.</p>
        ) : null}

        <div className="space-y-2">
          {(captures ?? []).map((c) => (
            <CaptureRow key={c.id} capture={c} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Ask the clipper
        </h2>
        <Chat agent="intake/clipper" />
      </section>
    </main>
  );
}
