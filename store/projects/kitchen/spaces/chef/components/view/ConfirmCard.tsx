import React from 'react';

/**
 * A confirmation card the concierge renders before a destructive or expensive action — replacing an
 * existing week, removing meals, bulk pantry edits, or anything that spends money. The agent
 * *proposes*; the user *commits*. This is a display-only summary of what's about to happen (the
 * agent asks for a yes/no in chat); it echoes the diff so the change is legible before it runs.
 */
export function ConfirmCard({
  title,
  summary,
  items,
  danger,
}: {
  title: string;
  summary?: string;
  /** the concrete changes about to be made, one line each. */
  items?: string[];
  /** true for irreversible/costly actions — accents the card as a caution. */
  danger?: boolean;
}) {
  return (
    <div
      className={
        danger
          ? 'rounded-md border border-destructive/50 bg-destructive/5 p-3'
          : 'rounded-md border border-border bg-card p-3'
      }
    >
      <div className={danger ? 'text-sm font-semibold text-destructive' : 'text-sm font-semibold text-foreground'}>
        {title}
      </div>
      {summary ? <p className="mt-1 text-sm text-muted-foreground">{summary}</p> : null}
      {items && items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground" aria-hidden>
                •
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">Reply to confirm or cancel.</p>
    </div>
  );
}

export default ConfirmCard;
