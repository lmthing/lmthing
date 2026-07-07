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
  const annotationCount = (article as { annotationCount?: number }).annotationCount ?? 0;
  const collectionCount = (article as { collectionCount?: number }).collectionCount ?? 0;
  const editorNote = (article as { editorNote?: string }).editorNote;

  return (
    <article
      className={`group relative flex gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary hover:shadow-sm ${
        article.pinned ? 'border-primary' : 'border-border'
      }`}
    >
      {article.imageUrl ? (
        <Link href={`/feed/${article.id}`} className="shrink-0">
          <img
            src={article.imageUrl}
            alt=""
            className="h-24 w-24 rounded-lg border border-border object-cover"
          />
        </Link>
      ) : null}

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {article.pinned ? (
              <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                📌 Pinned
              </span>
            ) : null}
            <Link
              href={`/feed/${article.id}`}
              className={`block font-bold leading-snug hover:text-primary ${
                article.read ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {article.title}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {!article.read ? (
              <span
                className="inline-block h-2 w-2 rounded-full bg-primary"
                title="Unread"
                aria-label="Unread"
              />
            ) : null}
            {article.saved ? (
              <span className="text-sm text-primary" title="Saved" aria-label="Saved">
                ★
              </span>
            ) : null}
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>

        {editorNote ? (
          <p className="border-l-2 border-primary pl-2 text-xs italic text-muted-foreground">
            {editorNote}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {tags.map((t) => (
            <Link
              key={t}
              href={`/tag/${t}`}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              #{t}
            </Link>
          ))}
          {annotationCount > 0 ? (
            <span className="text-xs text-muted-foreground" title="Annotations">
              ✎ {annotationCount}
            </span>
          ) : null}
          {collectionCount > 0 ? (
            <span className="text-xs text-muted-foreground" title="In collections">
              ▤ {collectionCount}
            </span>
          ) : null}
        </div>

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
