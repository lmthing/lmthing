import React, { useEffect, useState } from 'react';
import { useApi, apiCall } from '@app/runtime';
import { MarkdownBody } from './MarkdownBody';
import { Icon } from './icons';

type Kind = 'tldr' | 'eli5' | 'why-me';

interface Take {
  id: string;
  articleId: string;
  kind: Kind;
  body: string;
  status: 'pending' | 'ready' | 'error';
  createdAt: string;
}

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'tldr', label: 'TL;DR' },
  { kind: 'eli5', label: 'Explain simply' },
  { kind: 'why-me', label: 'Why this matters to me' },
];

/**
 * Inline reading-side takes: one-shot LLM reframings of the already-synthesized
 * article (a 3-bullet TL;DR, a plain-language ELI5, or a personalized "why this
 * matters"). Requests are cached server-side on `article_takes`, so a second
 * click re-shows the cached result rather than regenerating.
 */
export function ArticleTakes({ articleId }: { articleId: string }) {
  const { data: takes, refetch } = useApi<Take[]>('getTakes', { id: articleId });
  const [active, setActive] = useState<Kind | null>(null);
  const [requesting, setRequesting] = useState<Kind | null>(null);

  const latestFor = (kind: Kind): Take | undefined =>
    (takes ?? []).filter((t) => t.kind === kind)[0];

  const anyPending = (takes ?? []).some((t) => t.status === 'pending');

  // Poll while a take is still composing (§2.1 — surface the async run as it lands).
  useEffect(() => {
    if (!anyPending) return;
    const id = setInterval(() => refetch?.(), 2500);
    return () => clearInterval(id);
  }, [anyPending, refetch]);

  const onRequest = async (kind: Kind) => {
    setActive(kind);
    const existing = latestFor(kind);
    if (existing && existing.status === 'ready') return; // cached — just show it
    setRequesting(kind);
    try {
      await apiCall('requestTake', { id: articleId, kind });
      refetch?.();
    } catch {
      // surfaced via the take row status
    } finally {
      setRequesting(null);
    }
  };

  const activeTake = active ? latestFor(active) : undefined;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon name="sparkle" className="h-3.5 w-3.5" filled /> Quick takes
      </div>
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onRequest(kind)}
            aria-pressed={active === kind}
            className={
              active === kind
                ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                : 'rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-muted'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {active ? (
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          {requesting === active || activeTake?.status === 'pending' ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
              Composing…
            </p>
          ) : activeTake?.status === 'error' ? (
            <p className="text-destructive">Couldn't generate that take. Try again.</p>
          ) : activeTake?.status === 'ready' && activeTake.body ? (
            <MarkdownBody markdown={activeTake.body} />
          ) : (
            <p className="text-muted-foreground">Requesting…</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Get a grounded summary of this article — cached after the first time.
        </p>
      )}
    </div>
  );
}
