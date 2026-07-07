import React, { useEffect, useRef, useState } from 'react';
import type { Article } from '@app/types';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/EmptyState';
import { AnnotationItem, type AnnotationLike } from '../../components/AnnotationItem';
import { AddToCollectionMenu } from '../../components/AddToCollectionMenu';
import { ArticleTakes } from '../../components/ArticleTakes';
import { Icon } from '../../components/icons';
import { relativeTime, hostLabel } from '../../components/format';

interface Citation {
  id?: string;
  quote?: string;
  title?: string;
  url?: string;
  source?: string;
}

export default function ArticleDetail({ params }: { params: { articleId: string } }) {
  const { articleId } = params;
  const { data: article, isLoading, error, refetch } = useApi<Article>('getArticle', { id: articleId });

  const saveArticle = useApiMutation<{ ok: boolean }>('saveArticle', {
    invalidates: ['getArticle', 'feedList', 'feedStats'],
  });

  const {
    data: annotations,
    isLoading: annotationsLoading,
    error: annotationsError,
  } = useApi<AnnotationLike[]>('listAnnotations', { id: articleId });

  const addAnnotation = useApiMutation<AnnotationLike>('addAnnotation', {
    invalidates: ['listAnnotations'],
  });
  const removeAnnotation = useApiMutation<{ ok: boolean }>('removeAnnotation', {
    invalidates: ['listAnnotations'],
  });

  const [quote, setQuote] = useState('');
  const [note, setNote] = useState('');

  const onAddAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote.trim()) return;
    try {
      await addAnnotation.mutate({ id: articleId, quote: quote.trim(), note: note.trim() || undefined, kind: 'note' });
      setQuote('');
      setNote('');
    } catch {
      // error surfaced below via addAnnotation.error
    }
  };

  // Mark read on open.
  useEffect(() => {
    if (articleId) {
      apiCall('markRead', { id: articleId }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // Dwell capture (§1.6) — emit a 'dwell' reading-event on close so the
  // personalizer can close the loop the schema already anticipates.
  const openedAt = useRef<number>(Date.now());
  useEffect(() => {
    openedAt.current = Date.now();
    const flush = () => {
      const dwellMs = Date.now() - openedAt.current;
      if (dwellMs < 1500) return; // ignore incidental glances
      apiCall('logReadingEvent', { articleId, kind: 'dwell', dwellMs }).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  if (isLoading) return <Spinner />;

  if (error || !article) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <ErrorState message="Failed to load article." onRetry={() => refetch?.()} />
      </main>
    );
  }

  const tags = Array.isArray(article.tags) ? article.tags : [];
  const citations = (Array.isArray((article as { citations?: Citation[] }).citations)
    ? (article as { citations?: Citation[] }).citations
    : []) as Citation[];
  const createdAt = (article as { createdAt?: string }).createdAt;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        ← Back to feed
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main reading column */}
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            {article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt=""
                className="w-full rounded-lg border border-border object-cover"
              />
            ) : null}

            <h1 className="text-3xl font-bold leading-tight text-foreground">{article.title}</h1>

            {createdAt ? (
              <p className="text-sm text-muted-foreground">{relativeTime(createdAt)}</p>
            ) : null}

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Link
                    key={t}
                    href={`/tag/${t}`}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:text-primary hover:border-primary"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="max-w-prose text-[1.05rem] leading-relaxed">
            <MarkdownBody markdown={article.body ?? ''} />
          </div>

          {citations.length > 0 ? (
            <div className="space-y-3 border-t border-border pt-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Sources · {citations.length}
              </h2>
              <ul className="space-y-2">
                {citations.map((c, i) => {
                  const label = c.title || c.source || hostLabel(c.url) || c.url;
                  return (
                    <li
                      key={c.id ?? i}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      {c.quote ? (
                        <p className="leading-relaxed text-foreground">“{c.quote}”</p>
                      ) : null}
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {label} ↗
                        </a>
                      ) : label && !c.quote ? (
                        <span className="text-muted-foreground">{label}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Annotations</h2>

            <form
              onSubmit={onAddAnnotation}
              className="space-y-3 rounded-lg border border-border bg-card p-4"
            >
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Quote or highlight from the article…"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
              <button
                type="submit"
                disabled={addAnnotation.isPending || !quote.trim()}
                className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              >
                {addAnnotation.isPending ? 'Adding…' : 'Add annotation'}
              </button>
              {addAnnotation.error ? (
                <p className="text-sm text-destructive">
                  {(addAnnotation.error as { message?: string })?.message ?? 'Failed to add annotation.'}
                </p>
              ) : null}
            </form>

            {annotationsLoading ? <Spinner /> : null}
            {annotationsError ? (
              <ErrorState message="Failed to load annotations." />
            ) : null}
            {!annotationsLoading && !annotationsError && (annotations ?? []).length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
                No annotations yet. Highlight a passage above.
              </div>
            ) : null}

            <div className="space-y-2">
              {(annotations ?? []).map((a) => (
                <AnnotationItem
                  key={a.id}
                  annotation={a}
                  onRemove={() => removeAnnotation.mutate({ id: a.id })}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right rail — actions & intelligence */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saveArticle.isPending}
              onClick={() => saveArticle.mutate({ id: article.id, saved: !article.saved })}
              className={
                article.saved
                  ? 'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50'
                  : 'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50'
              }
            >
              <Icon name="save" className="h-4 w-4" filled={!!article.saved} />
              {article.saved ? 'Saved' : 'Save'}
            </button>
            <AddToCollectionMenu articleId={article.id} />
          </div>

          <Link
            href={`/feed/${article.id}/research`}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
          >
            <Icon name="deepDive" className="h-5 w-5" />
            Deep dive & fact-check →
          </Link>

          <ArticleTakes articleId={article.id} />
        </aside>
      </div>
    </main>
  );
}
