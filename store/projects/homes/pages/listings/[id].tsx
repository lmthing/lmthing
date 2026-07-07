import React, { useState } from 'react';
import type { Listing, ListingAnalysis, LocationGuess, Commute, Search } from '@app/types';
import { useApi, useApiMutation, Link, Chat } from '@app/runtime';
import { ScoreBadge } from '../../components/ScoreBadge';
import { FlagChips } from '../../components/FlagChips';
import { TrueCostBreakdown } from '../../components/TrueCostBreakdown';
import { CommuteChips } from '../../components/CommuteChips';
import { LocationGuessPanel } from '../../components/LocationGuessPanel';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';
import { formatMoney, humanizeSlug } from '../../components/format';

interface CostLine {
  label: string;
  amount: number;
  basis: string;
  note?: string;
}
interface PhotoItem {
  url: string;
  caption?: string;
}

type ListingDetail = Listing & {
  costBreakdown: CostLine[];
  photoUrls: PhotoItem[];
  flags: string[];
  analyses: ListingAnalysis[];
  guesses: LocationGuess[];
  commutes: Commute[];
};

const STATUSES = ['new', 'shortlisted', 'contacted', 'viewing', 'applied', 'dismissed', 'gone'];

const ANALYSIS_LABEL: Record<string, string> = {
  photos: 'Photo read',
  floorplan: 'Floor plan',
  mismatch: 'Consistency check',
};

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');

  const { data: listing, isLoading, error } = useApi<ListingDetail>('getListing', { id });

  const { data: search } = useApi<Search & { commuteTargets: { label: string; maxMinutes: number }[] }>(
    'getSearch',
    { id: listing?.searchId ?? '' },
    { enabled: !!listing?.searchId },
  );

  const saveListing = useApiMutation<{ ok: boolean }>('saveListing', {
    invalidates: ['getListing', 'listingFeed'],
  });
  const dismissListing = useApiMutation<{ ok: boolean }>('dismissListing', {
    invalidates: ['getListing', 'listingFeed'],
  });
  const updateListing = useApiMutation<Listing>('updateListing', {
    invalidates: ['getListing', 'listingFeed'],
  });

  if (isLoading && !listing) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <Spinner label="Loading listing…" />
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load listing.
        </div>
      </main>
    );
  }

  const flags = Array.isArray(listing.flags) ? (listing.flags as string[]) : [];
  const photos = Array.isArray(listing.photoUrls) ? (listing.photoUrls as PhotoItem[]) : [];
  const costLines = Array.isArray(listing.costBreakdown) ? (listing.costBreakdown as CostLine[]) : [];
  const analyses = listing.analyses ?? [];
  const guesses = listing.guesses ?? [];
  const commutes = listing.commutes ?? [];
  const targets = Array.isArray(search?.commuteTargets) ? search!.commuteTargets : [];

  const bestGuess = guesses.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

  const confirmDismiss = async () => {
    try {
      await dismissListing.mutate({ id, reason: reason.trim() });
      setDismissing(false);
      setReason('');
    } catch {
      // surfaced via dismissListing.error below
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href={`/searches/${listing.searchId}`}
        className="text-sm text-muted-foreground hover:text-primary"
      >
        ← Back to feed
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-6 rounded-lg border border-border bg-card p-6">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{listing.title}</h1>
            <select
              value={listing.status}
              onChange={(e) => updateListing.mutate({ id, status: e.target.value })}
              disabled={updateListing.isPending}
              title="Pipeline status"
              className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground disabled:opacity-50"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {listing.portal ? <span>{listing.portal}</span> : null}
            {listing.address ? <span>{listing.address}</span> : null}
            {listing.url ? (
              <a
                href={listing.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Original listing →
              </a>
            ) : null}
          </div>

          <p className="text-2xl font-bold text-foreground">
            {formatMoney(listing.priceAmount, listing.currency)}
          </p>

          {!dismissing ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => saveListing.mutate({ id })}
                disabled={saveListing.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
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
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why? (kitchen too dark, too noisy…)"
                className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={confirmDismiss}
                disabled={dismissListing.isPending}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                Confirm dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissing(false);
                  setReason('');
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          <ScoreBadge score={listing.score} size="lg" />
          {flags.length > 0 ? <FlagChips flags={flags} /> : null}
        </div>
      </div>

      {listing.scoreSummary ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Why this score
          </h2>
          <MarkdownBody source={listing.scoreSummary} />
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Photos
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <figure key={i} className="w-48 shrink-0 space-y-1">
                <img
                  src={p.url}
                  alt={p.caption ?? ''}
                  loading="lazy"
                  className="h-32 w-48 rounded-md border border-border object-cover"
                />
                {p.caption ? (
                  <figcaption className="line-clamp-2 text-xs text-muted-foreground">
                    {p.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TrueCostBreakdown
          trueCostMonthly={listing.trueCostMonthly}
          costBreakdown={costLines}
          currency={listing.currency}
        />
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Size & layout
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
              {listing.rooms > 0 ? <span>{listing.rooms} rooms</span> : null}
              {listing.bedrooms > 0 ? <span>{listing.bedrooms} bed</span> : null}
              {listing.areaSqm > 0 ? <span>{listing.areaSqm} m² stated</span> : null}
              {listing.measuredAreaSqm > 0 ? (
                <span>{listing.measuredAreaSqm} m² measured</span>
              ) : null}
              {listing.floor ? <span>{listing.floor}</span> : null}
              {listing.yearBuilt > 0 ? <span>built {listing.yearBuilt}</span> : null}
            </div>
          </div>

          {commutes.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Commutes
              </h3>
              <CommuteChips commutes={commutes} targets={targets} />
            </div>
          ) : null}
        </div>
      </div>

      {bestGuess ? <LocationGuessPanel guess={bestGuess} /> : null}

      {listing.description ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Description
          </h2>
          <MarkdownBody source={listing.description} />
        </div>
      ) : null}

      {analyses.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Scout analyses
          </h2>
          {analyses.map((a) => {
            const aFlags = Array.isArray(a.flags) ? (a.flags as string[]) : [];
            return (
              <div key={a.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-foreground">
                    {ANALYSIS_LABEL[a.kind] ?? humanizeSlug(a.kind)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((a.confidence ?? 0) * 100)}% confidence
                  </span>
                </div>
                <MarkdownBody source={a.body ?? ''} />
                {aFlags.length > 0 ? <FlagChips flags={aFlags} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Ask the analyst
        </h2>
        <Chat agent="scout/analyst" />
      </section>
    </main>
  );
}
