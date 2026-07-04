import React from 'react';

/**
 * A checklist of packing items for a trip — shown in chat after the packer builds or updates a
 * trip's `packing_items`. Purely presentational; toggling `packed` happens elsewhere in the app.
 */
export function PackingChecklist({
  items,
}: {
  items: { label: string; category?: string; reason?: string; packed?: boolean }[];
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No packing items yet.</p>;
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={
                item.packed
                  ? 'mt-0.5 inline-block h-3.5 w-3.5 flex-none rounded-sm border border-primary bg-primary'
                  : 'mt-0.5 inline-block h-3.5 w-3.5 flex-none rounded-sm border border-border'
              }
            />
            <div className="min-w-0">
              <span
                className={
                  item.packed
                    ? 'text-sm text-muted-foreground line-through'
                    : 'text-sm text-foreground'
                }
              >
                {item.label}
              </span>
              {item.reason ? (
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PackingChecklist;
