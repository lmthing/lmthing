import React from 'react';
import type { Search } from '@app/types';
import { Link } from '@app/runtime';
import { formatMoney, scoreBand } from './format';

type SearchWithCounts = Search & {
  unreadAlerts?: number;
  newListings?: number;
  tracked?: number;
  shortlisted?: number;
  bestScore?: number;
  lastCaptureAt?: string;
};

function relTime(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function SearchCard({
  search,
  onToggleStatus,
}: {
  search: SearchWithCounts;
  onToggleStatus?: (id: string, next: string) => void;
}) {
  const modePillClass =
    search.mode === 'buy'
      ? 'rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground'
      : 'rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground';

  const newListings = search.newListings ?? 0;
  const unreadAlerts = search.unreadAlerts ?? 0;
  const tracked = search.tracked ?? 0;
  const shortlisted = search.shortlisted ?? 0;
  const bestScore = search.bestScore ?? 0;
  const paused = search.status === 'paused';
  const band = scoreBand(bestScore);

  const footer = [
    `${tracked} tracked`,
    shortlisted > 0 ? `${shortlisted} shortlisted` : null,
    bestScore > 0 ? `best ${bestScore}` : null,
    search.lastCaptureAt ? `last capture ${relTime(search.lastCaptureAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/searches/${search.id}`}
      className="block space-y-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-foreground">{search.title}</span>
        <span className={modePillClass}>{search.mode}</span>
      </div>

      {search.area ? <p className="text-sm text-muted-foreground">{search.area}</p> : null}

      <p className="text-sm text-muted-foreground">
        up to{' '}
        <span className="font-medium text-foreground">
          {formatMoney(search.budgetMax, search.currency)}
        </span>
        {search.mode === 'rent' ? '/mo' : ''}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {newListings > 0 ? (
          <span className="rounded-full bg-agent px-2 py-0.5 text-xs font-medium text-agent-foreground">
            {newListings} new
          </span>
        ) : null}
        {unreadAlerts > 0 ? (
          <span className="rounded-full border border-primary px-2 py-0.5 text-xs text-primary">
            {unreadAlerts} alert{unreadAlerts === 1 ? '' : 's'}
          </span>
        ) : null}
        {bestScore >= 80 ? (
          <span className={`rounded-full border border-border px-2 py-0.5 text-xs font-medium ${band.tone}`}>
            {band.word} match
          </span>
        ) : null}
        {/* In-place active/paused toggle — stop the click from navigating. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleStatus?.(search.id, paused ? 'active' : 'paused');
          }}
          aria-label={paused ? 'Resume search' : 'Pause search'}
          className={
            'ml-auto rounded-full px-2 py-0.5 text-xs transition-colors ' +
            (paused
              ? 'border border-border text-muted-foreground hover:text-foreground'
              : 'border border-success text-success hover:bg-muted')
          }
        >
          {paused ? 'paused' : 'active'}
        </button>
      </div>

      {footer ? <p className="text-xs text-muted-foreground">{footer}</p> : null}
    </Link>
  );
}
