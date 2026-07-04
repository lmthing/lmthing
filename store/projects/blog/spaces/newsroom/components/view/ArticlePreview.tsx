import React from 'react';

/**
 * A small catalog display for a synthesized article — shown in chat while the synthesizer is
 * discussing or has just written it up, before/alongside it appearing in the main feed.
 */
export function ArticlePreview({
  title,
  summary,
  tags,
}: {
  title: string;
  summary?: string;
  tags?: string[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
      {tags && tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ArticlePreview;
