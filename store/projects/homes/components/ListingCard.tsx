import React, { useState } from 'react';
import type { Listing } from '@app/types';
import { Link } from '@app/runtime';
import { ScoreBadge } from './ScoreBadge';
import { FlagChips } from './FlagChips';
import { CommuteChips } from './CommuteChips';
import { formatMoney } from './format';

interface CommuteTargetLite {
  label: string;
  maxMinutes: number;
}

export function ListingCard({
  listing,
  onSave,
  onDismiss,
  targets,
}: {
  listing: Listing;
  onSave?: (reason?: string) => void;
  onDismiss?: (reason: string) => void;
  targets?: CommuteTargetLite[];
}) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');

  const flags = Array.isArray(listing.flags) ? (listing.flags as string[]) : [];
  const commutes = listing.commutes ?? [];

  const sizeOverstated =
    listing.measuredAreaSqm > 0 &&
    listing.areaSqm > 0 &&
    listing.measuredAreaSqm < listing.areaSqm * 0.9;

  const pricePerSqm = listing.areaSqm > 0 ? listing.priceAmount / listing.areaSqm : 0;

  const confirmDismiss = () => {
    onDismiss?.(reason.trim());
    setDismissing(false);
    setReason('');
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/listings/${listing.id}`}
            className="block font-semibold leading-snug text-foreground hover:text-primary"
          >
            {listing.title}
          </Link>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {listing.portal ? <span>{listing.portal}</span> : null}
            {listing.address ? (
              <span className="truncate">
                {listing.portal ? '· ' : ''}
                {listing.address}
              </span>
            ) : null}
          </div>
        </div>
        <ScoreBadge score={listing.score} size="sm" />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {listing.trueCostMonthly > 0 ? (
          <span className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {formatMoney(listing.priceAmount, listing.currency)} asked
            </span>
            <span className="text-lg font-bold text-foreground">
              {formatMoney(listing.trueCostMonthly, listing.currency)} all-in
            </span>
          </span>
        ) : (
          <span className="text-lg font-bold text-foreground">
            {formatMoney(listing.priceAmount, listing.currency)}
          </span>
        )}
        {pricePerSqm > 0 ? (
          <span className="text-sm text-muted-foreground">
            {formatMoney(pricePerSqm, listing.currency)}/m²
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {listing.rooms > 0 ? <span>{listing.rooms} rm</span> : null}
        {listing.bedrooms > 0 ? <span>{listing.bedrooms} bed</span> : null}
        {listing.areaSqm > 0 ? <span>{listing.areaSqm} m²</span> : null}
        {listing.floor ? <span>{listing.floor}</span> : null}
      </div>

      {sizeOverstated ? (
        <p className="text-xs text-destructive">
          Measured {listing.measuredAreaSqm} m² vs {listing.areaSqm} m² stated — size likely
          overstated
        </p>
      ) : null}

      {flags.length > 0 ? <FlagChips flags={flags} /> : null}
      {commutes.length > 0 ? <CommuteChips commutes={commutes} targets={targets} /> : null}

      {listing.scoreSummary ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{listing.scoreSummary}</p>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border pt-3">
        {!dismissing ? (
          <>
            <button
              type="button"
              onClick={() => onSave?.()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setDismissing(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              Dismiss
            </button>
          </>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (kitchen too dark, too noisy…)"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={confirmDismiss}
              className="shrink-0 rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissing(false);
                setReason('');
              }}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
