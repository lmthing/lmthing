import React from 'react';
import { Link } from '@app/runtime';

export interface CollectionLike {
  id: string;
  title: string;
  description?: string;
  kind?: 'smart' | 'manual';
  articleCount?: number;
  pinned?: boolean;
}

export function CollectionCard({ collection }: { collection: CollectionLike }) {
  const kindClass =
    collection.kind === 'smart'
      ? 'bg-primary text-primary-foreground'
      : 'border border-border text-muted-foreground';

  return (
    <Link
      href={`/collections/${collection.id}`}
      className="block space-y-2 rounded-lg border border-border bg-card p-4 hover:bg-muted transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-foreground">{collection.title}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${kindClass}`}>
          {collection.kind ?? 'manual'}
        </span>
      </div>

      {collection.description ? (
        <p className="text-sm text-muted-foreground line-clamp-3">{collection.description}</p>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{collection.articleCount ?? 0} articles</span>
        {collection.pinned ? <span className="text-xs text-primary">📌 Pinned</span> : null}
      </div>
    </Link>
  );
}
