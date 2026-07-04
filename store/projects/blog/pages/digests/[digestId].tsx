import React from 'react';
import { useApi, Link } from '@app/runtime';
import type { DigestLike } from '../../components/DigestCard';
import { NewsletterView, type NewsletterLike } from '../../components/NewsletterView';
import { Spinner } from '../../components/Spinner';

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
  const { data: digest, isLoading, error } = useApi<DigestDetail>('getDigest', { id: digestId });
  const { data: newsletter } = useApi<NewsletterLike | null>('getNewsletter', { id: digestId });

  if (isLoading) return <Spinner />;

  if (error || !digest) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load digest.
        </div>
      </main>
    );
  }

  const items = [...(digest.items ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/digests" className="text-sm text-muted-foreground hover:text-primary">
          ← All digests
        </Link>
        <h1 className="mt-2 text-xl font-bold text-foreground">{digest.title}</h1>
        {digest.summary ? <p className="mt-1 text-sm text-muted-foreground">{digest.summary}</p> : null}
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {digest.period ?? 'daily'}
          </span>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
            {digest.status ?? 'ready'}
          </span>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Articles</h2>

        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No articles in this digest.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/feed/${item.articleId}`}
                    className="font-bold text-foreground hover:text-primary"
                  >
                    {item.article?.title ?? 'Untitled article'}
                  </Link>
                  {item.topicSlug ? (
                    <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                      #{item.topicSlug}
                    </span>
                  ) : null}
                </div>
                {item.blurb ? <p className="text-sm text-muted-foreground">{item.blurb}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {newsletter ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Newsletter</h2>
          <NewsletterView newsletter={newsletter} />
        </section>
      ) : null}
    </main>
  );
}
