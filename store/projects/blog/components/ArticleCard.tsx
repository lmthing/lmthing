import React from 'react';
import type { Article } from '@app/types';
import { Link } from '@app/runtime';
import { Icon } from './icons';
import { RelevanceMeter } from './RelevanceMeter';
import { relativeTime, hostLabel } from './format';

interface CitationLite {
  source?: string;
  url?: string;
}

/**
 * A scannable editorial feed card: optional hero thumbnail (token placeholder
 * when null), headline + deck, a source/time signal row, a relevance meter, a
 * pinned ribbon, the editor's note callout, and keyboard-reachable hover actions.
 */
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
  const createdAt = (article as { createdAt?: string }).createdAt;
  const citations = (article as { citations?: CitationLite[] }).citations ?? [];
  const firstSource =
    citations.find((c) => c.source)?.source ?? hostLabel(citations.find((c) => c.url)?.url);
  const rel = relativeTime(createdAt);

  return (
    <article
      className={`group relative flex gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary hover:shadow-sm ${
        article.pinned ? 'border-primary' : 'border-border'
      }`}
    >
      <Link href={`/feed/${article.id}`} className="shrink-0" aria-hidden={!article.imageUrl}>
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="h-24 w-24 rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <Icon name="feed" className="h-6 w-6" />
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {article.pinned ? (
              <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                <Icon name="pin" className="h-3.5 w-3.5" filled /> Pinned
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
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <RelevanceMeter score={article.score} />
            {!article.read ? (
              <span
                className="inline-block h-2 w-2 rounded-full bg-primary"
                title="Unread"
                aria-label="Unread"
              />
            ) : null}
            {article.saved ? (
              <span className="text-primary" title="Saved" aria-label="Saved">
                <Icon name="save" className="h-4 w-4" filled />
              </span>
            ) : null}
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>

        {/* Signal row: source chip + relative time */}
        {firstSource || rel ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {firstSource ? (
              <span className="rounded-full border border-border bg-background px-2 py-0.5">
                {firstSource}
              </span>
            ) : null}
            {rel ? <span>{rel}</span> : null}
          </div>
        ) : null}

        {editorNote ? (
          <p className="border-l-2 border-primary pl-2 text-xs italic text-muted-foreground">
            <span className="font-semibold not-italic text-foreground">Editor's note: </span>
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

        {/* Actions — always keyboard-reachable, visually promoted on hover/focus. */}
        <div className="flex items-center gap-1.5 pt-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          {onPin ? (
            <button
              type="button"
              onClick={onPin}
              className={
                article.pinned
                  ? 'inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground'
                  : 'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted'
              }
            >
              <Icon name="pin" className="h-3.5 w-3.5" /> {article.pinned ? 'Unpin' : 'Pin'}
            </button>
          ) : null}
          <Link
            href={`/feed/${article.id}/research`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
          >
            <Icon name="deepDive" className="h-3.5 w-3.5" /> Deep-dive
          </Link>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <Icon name="dismiss" className="h-3.5 w-3.5" /> Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
