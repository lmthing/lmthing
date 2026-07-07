import React from 'react';

/**
 * A side-by-side merge/keep-separate prompt — raised by the clipper in a live chat session when
 * two candidate listings share an address, room count, and size band but disagree on price band
 * (the case a headless `parse-captures` run instead resolves by flagging both
 * `possible_duplicate` and leaving the decision for later).
 */
export function ConfirmMerge({
  existing,
  incoming,
  onMerge,
  onKeepSeparate,
}: {
  existing: { title: string; priceAmount: number; currency: string; areaSqm: number; portal?: string };
  incoming: { title: string; priceAmount: number; currency: string; areaSqm: number; portal?: string };
  onMerge?: () => void;
  onKeepSeparate?: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">Same place, or two different listings?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Same address, room count, and size — but the price doesn't quite match.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[existing, incoming].map((l, i) => (
          <div key={i} className="rounded border border-border bg-background p-2">
            <p className="text-sm text-foreground">{l.title}</p>
            <p className="text-xs text-muted-foreground">
              {l.currency} {l.priceAmount.toLocaleString()} · {l.areaSqm} m²
            </p>
            {l.portal ? <p className="text-xs text-muted-foreground">{l.portal}</p> : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onMerge}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Merge — same place
        </button>
        <button
          type="button"
          onClick={onKeepSeparate}
          className="rounded border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
        >
          Keep separate
        </button>
      </div>
    </div>
  );
}

export default ConfirmMerge;
