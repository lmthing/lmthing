import React from 'react';
import type { Article } from '@app/types';
import { Link } from '@app/runtime';

export function ArticleCard({
  article,
  onPin,
  onDismiss,
}: {
  article: Article;
  onPin?: () => void;
  onDismiss?: () => void;
}) {
  const tags = Array.isArray(article.tags) ? article.tags : [];

  return (
    <article className="flex gap-4 rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors">
      {article.imageUrl ? (
        <img
          src={article.imageUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-md object-cover border border-border"
        />
      ) : null}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/feed/${article.id}`} className="font-bold text-foreground hover:text-primary">
            {article.title}
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {!article.read ? (
              <span className="inline-block h-2 w-2 rounded-full bg-primary" title="Unread" />
            ) : null}
            {article.saved ? (
              <span className="text-xs text-primary" title="Saved">★</span>
            ) : null}
            {article.pinned ? (
              <span className="text-xs text-primary" title="Pinned">📌</span>
            ) : null}
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3">{article.summary}</p>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((t) => (
              <Link
                key={t}
                href={`/tag/${t}`}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-primary hover:border-primary"
              >
                #{t}
              </Link>
            ))}
          </div>
        ) : null}

        {onPin || onDismiss ? (
          <div className="flex items-center gap-2 pt-1">
            {onPin ? (
              <button
                type="button"
                onClick={onPin}
                className={
                  article.pinned
                    ? 'rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground'
                    : 'rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted'
                }
              >
                {article.pinned ? 'Unpin' : 'Pin'}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
