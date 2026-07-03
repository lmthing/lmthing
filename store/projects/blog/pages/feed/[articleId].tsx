import React, { useEffect } from 'react';
import type { Article } from '@app/types';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';

interface Citation {
  id?: string;
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
          <button
            type="button"
            disabled={saveArticle.isPending}
            onClick={() => saveArticle.mutate({ id: article.id, saved: !article.saved })}
            className={
              article.saved
                ? 'shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50'
                : 'shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50'
            }
          >
            {article.saved ? '★ Saved' : '☆ Save'}
          </button>
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
        <div className="space-y-2 border-t border-border pt-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Citations</h2>
          <ul className="space-y-1">
            {citations.map((c, i) => (
              <li key={c.id ?? i} className="text-sm">
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {c.title || c.url}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{c.title || c.source}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-border pt-4">
        <Link href={`/feed/${article.id}/research`} className="text-sm text-primary hover:underline">
          Deep dive research →
        </Link>
      </div>
    </main>
  );
}
