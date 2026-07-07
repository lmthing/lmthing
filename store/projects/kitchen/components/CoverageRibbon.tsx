import React from 'react';
import { Link } from '@app/runtime';
import { Package, ShoppingCart } from './icons';

/**
 * The app's core value proposition, surfaced on the home screen: how much of this week is already
 * cookable from the pantry, and how many items are left to buy — with a jump to Shop.
 */
export function CoverageRibbon({
  cookablePct,
  itemsToBuy,
}: {
  cookablePct: number;
  itemsToBuy: number;
}) {
  const good = cookablePct >= 75;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className={
            good
              ? 'flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary'
              : 'flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground'
          }
        >
          <Package className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            This week is {cookablePct}% cookable from your pantry
          </p>
          <p className="text-xs text-muted-foreground">
            {itemsToBuy === 0
              ? 'Nothing left to buy — you’re fully stocked.'
              : `${itemsToBuy} item${itemsToBuy === 1 ? '' : 's'} to buy`}
          </p>
        </div>
      </div>
      {itemsToBuy > 0 ? (
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Shop
        </Link>
      ) : null}
    </div>
  );
}

export default CoverageRibbon;
