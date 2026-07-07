import React, { useState } from 'react';
import type { Listing, ListingAnalysis, LocationGuess, Commute, Search } from '@app/types';
import { useApi, useApiMutation, apiCall, Link, Chat } from '@app/runtime';
import { ScoreBadge } from '../../components/ScoreBadge';
import { FlagChips } from '../../components/FlagChips';
import { TrueCostBreakdown } from '../../components/TrueCostBreakdown';
import { CommuteChips } from '../../components/CommuteChips';
import { LocationGuessPanel } from '../../components/LocationGuessPanel';
import { MarkdownBody } from '../../components/MarkdownBody';
import { Spinner } from '../../components/Spinner';
import { CalendarIcon } from '../../components/icons';
import { formatMoney, humanizeSlug, formatDateTime, scoreBand } from '../../components/format';

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

async function downloadIcs(id: string) {
  try {
    const res = (await apiCall('listingIcs', { id })) as {
      filename: string;
      ics: string;
      googleUrl: string;
    };
    const blob = new Blob([res.ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.open(res.googleUrl, '_blank', 'noopener');
  } catch {
    /* best-effort */
  }
}

export default function ListingDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');

  const { data: listing, isLoading, error, refetch } = useApi<ListingDetail>('getListing', { id });

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
      <main className="mx-auto max-w-5xl p-6">
        <Spinner label="Loading listing…" />
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="mx-auto max-w-5xl space-y-3 p-6">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive p-4 text-sm text-destructive">
          <span>Failed to load listing.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-destructive px-2 py-1 text-xs hover:bg-muted"
          >
            Retry
          </button>
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
  const band = scoreBand(listing.score);

  const bestGuess = guesses.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

  // Analyses timeline: newest first, grouped by kind so a deep-sweep re-read reads
  // as "supersedes earlier".
  const timeline = analyses
    .slice()
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const confirmDismiss = async () => {
    try {
      await dismissListing.mutate({ id, reason: reason.trim() });
      setDismissing(false);
      setReason('');
    } catch {
      /* surfaced below */
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link
        href={`/searches/${listing.searchId}`}
        className="text-sm text-muted-foreground hover:text-primary"
      >
        ← Back to feed
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[20rem_1fr]">
        {/* LEFT — the decision panel (sticky on md+) */}
        <div className="space-y-4 md:sticky md:top-4 md:self-start">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <ScoreBadge score={listing.score} size="lg" />
              <span className={`text-sm font-semibold ${band.tone}`}>{band.word}</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-lg font-bold leading-snug text-foreground">{listing.title}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {listing.portal ? <span>{listing.portal}</span> : null}
                {listing.address ? <span>{listing.address}</span> : null}
              </div>
              {listing.url ? (
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Original listing →
                </a>
              ) : null}
            </div>

            <div className="space-y-0.5">
              {listing.trueCostMonthly > 0 ? (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {formatMoney(listing.trueCostMonthly, listing.currency)}
                    <span className="text-sm font-normal text-muted-foreground"> all-in/mo</span>
                  </p>
                  <p className="text-sm text-muted-foreground line-through">
                    {formatMoney(listing.priceAmount, listing.currency)} asked
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {formatMoney(listing.priceAmount, listing.currency)}
                </p>
              )}
            </div>

            {flags.length > 0 ? <FlagChips flags={flags} /> : null}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
                Pipeline status
              </label>
              <select
                id="status"
                value={listing.status}
                onChange={(e) => updateListing.mutate({ id, status: e.target.value })}
                disabled={updateListing.isPending}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {!dismissing ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveListing.mutate({ id })}
                  disabled={saveListing.isPending}
                  className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setDismissing(true)}
                  className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why? (kitchen too dark, too noisy…)"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
                <div className="flex items-center gap-2">
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
              </div>
            )}

            <button
              type="button"
              onClick={() => downloadIcs(id)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              <CalendarIcon className="h-4 w-4" />
              Add viewing to calendar
            </button>
          </div>

          {listing.scoreSummary ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Why this score
              </h2>
              <MarkdownBody source={listing.scoreSummary} />
            </div>
          ) : null}

          {commutes.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Commutes
              </h3>
              <CommuteChips commutes={commutes} targets={targets} />
            </div>
          ) : null}
        </div>

        {/* RIGHT — the evidence */}
        <div className="min-w-0 space-y-6">
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrueCostBreakdown
              trueCostMonthly={listing.trueCostMonthly}
              costBreakdown={costLines}
              currency={listing.currency}
            />
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

          {timeline.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Scout analyses
              </h2>
              <div className="relative space-y-3 border-l border-border pl-4">
                {timeline.map((a, i) => {
                  const aFlags = Array.isArray(a.flags) ? (a.flags as string[]) : [];
                  const pct = Math.round((a.confidence ?? 0) * 100);
                  return (
                    <div key={a.id} className="relative space-y-2 rounded-lg border border-border bg-card p-4">
                      <span className="absolute -left-[1.42rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-card bg-agent" />
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-foreground">
                          {ANALYSIS_LABEL[a.kind] ?? humanizeSlug(a.kind)}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {a.createdAt ? formatDateTime(a.createdAt) : ''}
                          {i > 0 ? '' : ' · latest'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted" title={`${pct}% confidence`}>
                          <div className="h-1.5 rounded-full bg-agent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>
                      </div>
                      <MarkdownBody source={a.body ?? ''} />
                      {aFlags.length > 0 ? <FlagChips flags={aFlags} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Ask the analyst
            </h2>
            <div className="h-96 overflow-hidden rounded-lg border border-border">
              <Chat agent="scout/analyst" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
