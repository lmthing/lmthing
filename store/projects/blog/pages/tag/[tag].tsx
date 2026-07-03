import React from 'react';
import type { Article } from '@app/types';
import { useApi, Link } from '@app/runtime';
import { ArticleCard } from '../../components/ArticleCard';
import { Spinner } from '../../components/Spinner';

export default function TagFeed({ params }: { params: { tag: string } }) {
  const { tag } = params;
  const { data: articles, isLoading, error } = useApi<Article[]>('feedList', { tag });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">#{tag}</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← All articles
        </Link>
      </div>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load articles.
        </div>
      ) : null}

      {!isLoading && !error && (articles ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No articles tagged #{tag}.
        </div>
      ) : null}

      <div className="space-y-3">
        {(articles ?? []).map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </main>
  );
}
