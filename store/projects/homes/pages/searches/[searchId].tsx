import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Search, Listing, Alert } from '@app/types';
import { useApi, useApiMutation, apiCall, Link } from '@app/runtime';
import { SearchTabs } from '../../components/SearchTabs';
import { ListingCard } from '../../components/ListingCard';
import { ListingFeedSkeleton } from '../../components/ListingCardSkeleton';
import { AlertStrip } from '../../components/AlertStrip';
import { FeedToolbar, type FeedSort, type FeedFilter } from '../../components/FeedToolbar';
import { MarkdownBody } from '../../components/MarkdownBody';
import { SparklesIcon, XIcon } from '../../components/icons';

interface CommuteTargetLite {
  label: string;
  maxMinutes: number;
}

type SearchWithTargets = Search & {
  budgetMax: number;
  mode: string;
  commuteTargets: { label: string; address: string; mode: string; maxMinutes: number }[];
};

const WARNING_FLAGS = new Set([
  'size_overstated',
  'photo_text_mismatch',
  'possible_duplicate',
  'scam_signals',
]);

function bestCommute(l: Listing): number {
  const cs = (l as Listing & { commutes?: { minutes: number }[] }).commutes ?? [];
  if (!cs.length) return Infinity;
  return Math.min(...cs.map((c) => c.minutes ?? Infinity));
}

export default function SearchFeed({ params }: { params: { searchId: string } }) {
  const { searchId } = params;
  const [polling, setPolling] = useState(true);
  const [sort, setSort] = useState<FeedSort>('score');
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [acted, setActed] = useState<Set<string>>(new Set()); // optimistic removal
  const [cursor, setCursor] = useState(0); // keyboard highlight
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: search, error: searchError } = useApi<SearchWithTargets>('getSearch', {
    id: searchId,
  });

  const {
    data: listings,
    isLoading,
    error,
    refetch,
  } = useApi<Listing[]>(
    'listingFeed',
    { id: searchId },
    { refetchInterval: polling ? 4000 : undefined },
  );

  const { data: alerts, refetch: refetchAlerts } = useApi<Alert[]>('listAlerts', {
    id: searchId,
    unreadOnly: true,
  });

  const scoringCount = useMemo(
    () => (listings ?? []).filter((l) => (l.score ?? 0) === 0).length,
    [listings],
  );

  useEffect(() => {
    setPolling(scoringCount > 0);
  }, [scoringCount]);

  const saveListing = useApiMutation<{ ok: boolean }>('saveListing', {
    invalidates: ['listingFeed', 'searchList'],
  });
  const dismissListing = useApiMutation<{ ok: boolean }>('dismissListing', {
    invalidates: ['listingFeed', 'searchList'],
  });

  const onRead = async (id: string) => {
    try {
      await apiCall('markAlertRead', { id });
      refetchAlerts();
    } catch {
      /* best-effort */
    }
  };

  const optimisticSave = (id: string, reason?: string) => {
    setActed((s) => new Set(s).add(id));
    saveListing.mutate({ id, reason });
  };
  const optimisticDismiss = (id: string, reason: string) => {
    setActed((s) => new Set(s).add(id));
    dismissListing.mutate({ id, reason });
  };

  const targets: CommuteTargetLite[] = Array.isArray(search?.commuteTargets)
    ? search!.commuteTargets.map((t) => ({ label: t.label, maxMinutes: t.maxMinutes }))
    : [];
  const budgetMax = search?.budgetMax ?? 0;

  // Base = server list minus optimistically-acted rows.
  const base = useMemo(
    () => (listings ?? []).filter((l) => !acted.has(l.id)),
    [listings, acted],
  );

  const matches = (l: Listing, f: FeedFilter): boolean => {
    const flags = Array.isArray(l.flags) ? (l.flags as string[]) : [];
    const cost = l.trueCostMonthly > 0 ? l.trueCostMonthly : l.priceAmount;
    switch (f) {
      case 'new':
        return l.status === 'new';
      case 'shortlisted':
        return l.status === 'shortlisted';
      case 'flagged':
        return flags.some((fl) => WARNING_FLAGS.has(fl));
      case 'underBudget':
        return budgetMax > 0 && cost > 0 && cost <= budgetMax;
      default:
        return true;
    }
  };

  const counts = useMemo(() => {
    const c: Record<FeedFilter, number> = {
      all: base.length,
      new: 0,
      shortlisted: 0,
      flagged: 0,
      underBudget: 0,
    };
    for (const l of base) {
      (['new', 'shortlisted', 'flagged', 'underBudget'] as FeedFilter[]).forEach((f) => {
        if (matches(l, f)) c[f] += 1;
      });
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, budgetMax]);

  const view = useMemo(() => {
    const arr = base.filter((l) => matches(l, filter));
    arr.sort((a, b) => {
      switch (sort) {
        case 'trueCost': {
          const av = a.trueCostMonthly || a.priceAmount || Infinity;
          const bv = b.trueCostMonthly || b.priceAmount || Infinity;
          return av - bv;
        }
        case 'newest':
          return (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? '');
        case 'commute':
          return bestCommute(a) - bestCommute(b);
        default:
          return (b.score ?? 0) - (a.score ?? 0);
      }
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, filter, sort, budgetMax]);

  // Keyboard triage — j/k move, s save, x dismiss (empty reason), enter opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (!view.length) return;
      if (e.key === 'j') setCursor((c) => Math.min(view.length - 1, c + 1));
      else if (e.key === 'k') setCursor((c) => Math.max(0, c - 1));
      else if (e.key === 's') {
        const l = view[Math.min(cursor, view.length - 1)];
        if (l) optimisticSave(l.id);
      } else if (e.key === 'x') {
        const l = view[Math.min(cursor, view.length - 1)];
        if (l) optimisticDismiss(l.id, '');
      } else if (e.key === 'Enter') {
        const href = cardRefs.current[Math.min(cursor, view.length - 1)]?.dataset.href;
        if (href) window.location.assign(href);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor]);

  useEffect(() => {
    cardRefs.current[cursor]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);

  const digest = (alerts ?? []).find((a) => a.kind === 'digest');
  const stripAlerts = (alerts ?? []).filter((a) => a.kind !== 'digest');

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <SearchTabs
        searchId={searchId}
        active="feed"
        counts={{ feed: (listings ?? []).length }}
      />

      {searchError ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load search.
        </div>
      ) : null}

      {search ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{search.title}</h1>
            {search.status === 'paused' ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                paused
              </span>
            ) : null}
          </div>
          {search.brief ? <p className="text-sm text-muted-foreground">{search.brief}</p> : null}
        </div>
      ) : null}

      {digest ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary bg-card p-4">
          <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{digest.title}</p>
            {digest.body ? <MarkdownBody source={digest.body} /> : null}
          </div>
          <button
            type="button"
            onClick={() => onRead(digest.id)}
            aria-label="Dismiss digest"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {stripAlerts.length > 0 ? <AlertStrip alerts={stripAlerts} onRead={onRead} /> : null}

      {/* Live-arrival affordance */}
      {scoringCount > 0 ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-agent" />
          Scoring {scoringCount} new listing{scoringCount === 1 ? '' : 's'}…
        </div>
      ) : null}

      {!isLoading && !error && (listings ?? []).length > 0 ? (
        <FeedToolbar sort={sort} filter={filter} counts={counts} onSort={setSort} onFilter={setFilter} />
      ) : null}

      {isLoading && !listings ? <ListingFeedSkeleton /> : null}

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive p-4 text-sm text-destructive">
          <span>Failed to load listings.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-destructive px-2 py-1 text-xs hover:bg-muted"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && (listings ?? []).length === 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-10 text-center">
          <p className="font-medium text-foreground">No listings yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Paste the alert emails or saved-search pages you already get in the inbox and
            we&apos;ll clean, cost, and rank every match.
          </p>
          <Link
            href={`/searches/${searchId}/inbox`}
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to the inbox →
          </Link>
        </div>
      ) : null}

      {!isLoading && !error && (listings ?? []).length > 0 && view.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No listings match this filter.
        </p>
      ) : null}

      <div className="space-y-3">
        {view.map((l, i) => (
          <div
            key={l.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            data-href={`/listings/${l.id}`}
            className={i === cursor ? 'rounded-lg ring-2 ring-ring' : undefined}
          >
            <ListingCard
              listing={l}
              targets={targets}
              onSave={(reason) => optimisticSave(l.id, reason)}
              onDismiss={(reason) => optimisticDismiss(l.id, reason)}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
