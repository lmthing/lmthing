import React, { useEffect, useState } from 'react';
import type { Article } from '@app/types';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';
import { AnnotationItem, type AnnotationLike } from '../../components/AnnotationItem';
import { AddToCollectionMenu } from '../../components/AddToCollectionMenu';

interface Citation {
  id?: string;
  quote?: string;
  title?: string;
  url?: string;
  source?: string;
}

export default function ArticleDetail({ params }: { params: { articleId: string } }) {
  const { articleId } = params;
  const { data: article, isLoading, error } = useApi<Article>('getArticle', { id: articleId });

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

  useEffect(() => {
    if (articleId) {
      apiCall('markRead', { id: articleId }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  if (isLoading) return <Spinner />;

  if (error || !article) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load article.
        </div>
      </main>
    );
  }

  const tags = Array.isArray(article.tags) ? article.tags : [];
  const citations = (Array.isArray((article as { citations?: Citation[] }).citations)
    ? (article as { citations?: Citation[] }).citations
    : []) as Citation[];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-3">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="w-full rounded-lg border border-border object-cover"
          />
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{article.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <AddToCollectionMenu articleId={article.id} />
            <button
              type="button"
              disabled={saveArticle.isPending}
              onClick={() => saveArticle.mutate({ id: article.id, saved: !article.saved })}
              className={
                article.saved
                  ? 'rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50'
                  : 'rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50'
              }
            >
              {article.saved ? '★ Saved' : '☆ Save'}
            </button>
          </div>
        </div>

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

      <MarkdownBody markdown={article.body ?? ''} />

      {citations.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Sources · {citations.length}
          </h2>
          <ul className="space-y-2">
            {citations.map((c, i) => {
              const label = c.title || c.source || c.url;
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

      <div className="border-t border-border pt-4">
        <Link href={`/feed/${article.id}/research`} className="text-sm text-primary hover:underline">
          Deep dive research →
        </Link>
      </div>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Annotations</h2>

        <form
          onSubmit={onAddAnnotation}
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Quote from the article…"
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
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load annotations.
          </div>
        ) : null}
        {!annotationsLoading && !annotationsError && (annotations ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No annotations yet. Add one above.
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
    </main>
  );
}
