import React, { useState } from 'react';
import { useApi, useApiMutation, Link } from '@app/runtime';
import type { DigestLike } from '../../components/DigestCard';
import { NewsletterView, type NewsletterLike } from '../../components/NewsletterView';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/EmptyState';
import { Icon } from '../../components/icons';
import { humanize } from '../../components/format';

interface DigestItem {
  id: string;
  digestId: string;
  articleId: string;
  topicSlug?: string;
  position?: number;
  blurb?: string;
  article?: { id: string; title: string };
}

type DigestDetail = DigestLike & { items: DigestItem[] };

export default function DigestDetail({ params }: { params: { digestId: string } }) {
  const { digestId } = params;
  const { data: digest, isLoading, error, refetch } = useApi<DigestDetail>('getDigest', { id: digestId });
  const { data: newsletter } = useApi<NewsletterLike | null>('getNewsletter', { id: digestId });

  const [view, setView] = useState<'edition' | 'newsletter'>('edition');
  const [copied, setCopied] = useState(false);

  const sendNewsletter = useApiMutation<{ sent: boolean; reason?: string; to?: string }>(
    'sendNewsletter',
    {},
  );

  if (isLoading) return <Spinner />;

  if (error || !digest) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <ErrorState message="Failed to load digest." onRetry={() => refetch?.()} />
      </main>
    );
  }

  const items = [...(digest.items ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Bucket items by topic for the edition layout.
  const buckets = new Map<string, DigestItem[]>();
  for (const item of items) {
    const key = item.topicSlug || 'general';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }

  const nl = newsletter && (newsletter as { id?: string }).id ? newsletter : null;

  const onCopy = async () => {
    const body = (nl as { body?: string })?.body ?? '';
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  const sendResult = sendNewsletter.data;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/digests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        ← All digests
      </Link>

      {/* Masthead */}
      <header className="space-y-3 border-b-2 border-foreground pb-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
            {digest.period ?? 'daily'}
          </span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {digest.status ?? 'ready'} · {items.length} {items.length === 1 ? 'story' : 'stories'}
          </span>
        </div>
        <h1 className="text-3xl font-bold leading-tight text-foreground">{digest.title}</h1>
        {digest.summary ? (
          <p className="text-lg leading-relaxed text-muted-foreground">{digest.summary}</p>
        ) : null}

        {nl ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="inline-flex rounded-full border border-border p-0.5">
              <button
                type="button"
                onClick={() => setView('edition')}
                className={
                  view === 'edition'
                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                    : 'rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground'
                }
              >
                Edition
              </button>
              <button
                type="button"
                onClick={() => setView('newsletter')}
                className={
                  view === 'newsletter'
                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                    : 'rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground'
                }
              >
                Newsletter
              </button>
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-muted"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              type="button"
              disabled={sendNewsletter.isPending}
              onClick={() => sendNewsletter.mutate({ id: (nl as { id: string }).id })}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Icon name="send" className="h-3.5 w-3.5" />
              {sendNewsletter.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        ) : null}

        {sendResult ? (
          <p className="text-xs text-muted-foreground">
            {sendResult.sent
              ? `Sent to ${sendResult.to}.`
              : sendResult.reason === 'not-configured'
                ? 'Email delivery isn’t configured yet — set RESEND_API_KEY on the pod to enable sending.'
                : sendResult.reason === 'no-recipient'
                  ? 'Add a delivery email in Preferences to send this edition.'
                  : 'Could not send this edition.'}
          </p>
        ) : null}
      </header>

      {view === 'newsletter' && nl ? (
        <NewsletterView newsletter={nl} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No articles in this digest.
        </div>
      ) : (
        <div className="space-y-8">
          {[...buckets.entries()].map(([topic, group]) => (
            <section key={topic} className="space-y-4">
              <h2 className="border-b border-border pb-1 text-sm font-bold uppercase tracking-wide text-primary">
                {topic === 'general' ? 'In this edition' : humanize(topic)}
              </h2>
              <div className="space-y-5">
                {group.map((item) => (
                  <article key={item.id} className="space-y-2">
                    <Link
                      href={`/feed/${item.articleId}`}
                      className="block text-xl font-bold leading-snug text-foreground hover:text-primary"
                    >
                      {item.article?.title ?? 'Untitled article'}
                    </Link>
                    {item.blurb ? (
                      <p className="border-l-2 border-primary pl-3 text-[1.02rem] italic leading-relaxed text-muted-foreground">
                        {item.blurb}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
