import React from 'react';
import { Link } from '@app/runtime';

export interface SearchResultsData {
  articles?: { id: string; title: string }[];
  briefings?: { id: string; title?: string; topic?: string }[];
  collections?: { id: string; title: string }[];
}

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase text-muted-foreground">{title}</h2>
      {empty ? (
        <p className="text-sm text-muted-foreground">No matches.</p>
      ) : (
        <ul className="space-y-1">{children}</ul>
      )}
    </section>
  );
}

export function SearchResults({ results }: { results: SearchResultsData | null | undefined }) {
  const articles = results?.articles ?? [];
  const briefings = results?.briefings ?? [];
  const collections = results?.collections ?? [];

  return (
    <div className="space-y-6">
      <Section title="Articles" empty={articles.length === 0}>
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/feed/${a.id}`} className="text-foreground hover:text-primary">
              {a.title}
            </Link>
          </li>
        ))}
      </Section>

      <Section title="Briefings" empty={briefings.length === 0}>
        {briefings.map((b) => (
          <li key={b.id}>
            <Link href={`/briefings/${b.id}`} className="text-foreground hover:text-primary">
              {b.title ?? b.topic}
            </Link>
          </li>
        ))}
      </Section>

      <Section title="Collections" empty={collections.length === 0}>
        {collections.map((c) => (
          <li key={c.id}>
            <Link href={`/collections/${c.id}`} className="text-foreground hover:text-primary">
              {c.title}
            </Link>
          </li>
        ))}
      </Section>
    </div>
  );
}
