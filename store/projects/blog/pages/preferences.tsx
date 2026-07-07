import React, { useEffect, useState } from 'react';
import type { Source, Setting } from '@app/types';
import { useApi, useApiMutation, apiCall } from '@app/runtime';
import { SourceRow } from '../components/SourceRow';
import { Spinner } from '../components/Spinner';
import { ListSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { SourceHealthBar, type SourceHealthLike } from '../components/SourceHealthBar';

export default function Preferences() {
  const { data: sources, isLoading, error, refetch } = useApi<Source[]>('listSources', {});
  const { data: settings } = useApi<Setting & { deliveryEmail?: string }>('getSettings', {});
  const {
    data: sourceHealth,
    isLoading: sourceHealthLoading,
    error: sourceHealthError,
  } = useApi<SourceHealthLike[]>('sourceHealth', {});

  const removeSource = useApiMutation<{ ok: boolean }>('removeSource', {
    invalidates: ['listSources'],
  });
  const addSource = useApiMutation<Source>('addSource', {
    invalidates: ['listSources'],
  });
  const updateSettings = useApiMutation<Setting>('updateSettings', {
    invalidates: ['getSettings'],
  });

  const [kind, setKind] = useState<'rss' | 'search'>('rss');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');

  const [opml, setOpml] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<Record<string, string>>({});

  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  useEffect(() => {
    if (settings?.deliveryEmail) setEmail(settings.deliveryEmail);
  }, [settings?.deliveryEmail]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    try {
      await addSource.mutate({ kind, value: value.trim(), label: label.trim() || undefined });
      setValue('');
      setLabel('');
    } catch {
      // surfaced below
    }
  };

  const onImport = async () => {
    if (!opml.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const r = (await apiCall('importOpml', { opml })) as { imported: number; skipped: number };
      setImportMsg(`Imported ${r.imported} feed${r.imported === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped} duplicate${r.skipped === 1 ? '' : 's'}` : ''}.`);
      setOpml('');
      refetch?.();
    } catch (err) {
      setImportMsg((err as { message?: string })?.message ?? 'Could not import that OPML.');
    } finally {
      setImporting(false);
    }
  };

  const onExport = async () => {
    try {
      const r = (await apiCall('exportOpml', {})) as { opml: string };
      const blob = new Blob([r.opml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lmthing-blog-sources.opml';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // no-op
    }
  };

  const onIngest = async (s: Source) => {
    setIngestingId(s.id);
    setIngestStatus((m) => ({ ...m, [s.id]: '' }));
    try {
      const r = (await apiCall('ingestRss', { id: s.id })) as {
        inserted: number;
        status: string;
        error?: string;
      };
      setIngestStatus((m) => ({
        ...m,
        [s.id]: r.status === 'ok' ? `+${r.inserted} new` : `error`,
      }));
    } catch {
      setIngestStatus((m) => ({ ...m, [s.id]: 'error' }));
    } finally {
      setIngestingId(null);
    }
  };

  const onSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings.mutate({ deliveryEmail: email.trim() });
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 1500);
    } catch {
      // surfaced via updateSettings.error
    }
  };

  const list = sources ?? [];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Preferences</h1>
        {settings ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Tier: <span className="text-foreground">{settings.tier}</span> · Weekly budget: $
            {settings.weeklyBudgetUsd} · Max free sources: {settings.maxFreeSources}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Add source</h2>
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'rss' | 'search')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="rss">RSS</option>
              <option value="search">Search</option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === 'rss' ? 'https://example.com/feed.xml' : 'search query'}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={addSource.isPending || !value.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addSource.isPending ? 'Adding…' : 'Add source'}
          </button>
          {addSource.error ? (
            <p className="text-sm text-destructive">
              {/402|upgrade/i.test((addSource.error as { message?: string })?.message ?? '')
                ? 'You’ve reached the free-tier source cap — upgrade to add more sources.'
                : (addSource.error as { message?: string })?.message ?? 'Failed to add source.'}
            </p>
          ) : null}
        </form>
      </section>

      {/* OPML import / export */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Import / export (OPML)</h2>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Bring your feeds from another reader by pasting its OPML export, or download your current
            RSS sources as OPML.
          </p>
          <textarea
            value={opml}
            onChange={(e) => setOpml(e.target.value)}
            placeholder="Paste OPML XML here…"
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onImport}
              disabled={importing || !opml.trim()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import OPML'}
            </button>
            <button
              type="button"
              onClick={onExport}
              className="rounded-md border border-border bg-background px-4 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              Export OPML
            </button>
          </div>
          {importMsg ? <p className="text-sm text-muted-foreground">{importMsg}</p> : null}
        </div>
      </section>

      {/* Newsletter delivery */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Newsletter delivery</h2>
        <form onSubmit={onSaveEmail} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Where daily editions are sent when you hit “Send” on a digest. Delivery requires the pod’s
            email key (RESEND_API_KEY); until then, sending is disabled gracefully.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {emailSaved ? '✓ Saved' : updateSettings.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Sources</h2>

        {isLoading ? <ListSkeleton /> : null}
        {error ? <ErrorState message="Failed to load sources." onRetry={() => refetch?.()} /> : null}
        {!isLoading && !error && list.length === 0 ? (
          <EmptyState
            icon="subscriptions"
            title="No sources yet"
            message="Add an RSS feed or a search query above, or import an OPML file — the newsroom fetches from these."
          />
        ) : null}

        <div className="space-y-2">
          {list.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              onRemove={() => removeSource.mutate({ id: s.id })}
              onIngest={() => onIngest(s)}
              ingesting={ingestingId === s.id}
              ingestStatus={ingestStatus[s.id]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Source health</h2>

        {sourceHealthLoading ? <Spinner /> : null}
        {sourceHealthError ? (
          <ErrorState message="Failed to load source health." />
        ) : null}
        {!sourceHealthLoading && !sourceHealthError && (sourceHealth ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No source health data yet.
          </div>
        ) : null}

        <div className="space-y-2">
          {(sourceHealth ?? []).map((row) => (
            <SourceHealthBar key={row.id} row={row} />
          ))}
        </div>
      </section>
    </main>
  );
}
