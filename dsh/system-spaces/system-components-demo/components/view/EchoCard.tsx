import React from 'react';

/**
 * A toy catalog view component, built for this port to prove
 * `@lmthing/dsh-space-components` end to end (see
 * dsh/packages/space-components/demo/). Its prop signature is deliberately the
 * shape the static extractor DOES read — one destructured parameter with an
 * inline object type literal, mixing a required string, an optional string, an
 * optional number, an optional boolean, and an optional string array — so a
 * live run exercises every branch of `extractPropsSchema`'s type mapping at
 * once.
 *
 * Nothing renders this as real React. Per the plugin's explicit scope boundary,
 * a `display` call is a structured DECLARATION ("responding with EchoCard and
 * these props"), the same fidelity LMThing's own product has today; real UI
 * mounting is the separate `client-space-components` roadmap item.
 */
export function EchoCard({
  message,
  stamp,
  repeats,
  shouted,
  tags,
}: {
  message: string;
  stamp?: string;
  repeats?: number;
  shouted?: boolean;
  tags?: string[];
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm text-foreground">{shouted ? message.toUpperCase() : message}</p>
      {stamp ? <p className="mt-1 text-xs text-muted-foreground">{stamp}</p> : null}
      {repeats && repeats > 1 ? (
        <p className="mt-1 text-xs text-muted-foreground">×{repeats}</p>
      ) : null}
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

export default EchoCard;
