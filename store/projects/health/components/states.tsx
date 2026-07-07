import React from 'react';
import { Link } from '@app/runtime';
import { AlertIcon, CheckCircleIcon, SparkleIcon } from './icons';

// Shared empty / loading / error / pending building blocks so every list page
// speaks the same visual language. Token-driven only — never a raw color.

/** A single shimmering placeholder line. Respects prefers-reduced-motion via `motion-safe`. */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded bg-muted ${className}`}
      aria-hidden
    />
  );
}

/** A skeleton shaped like a typical list row (title + subtitle + trailing chip). */
export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine className="h-4 w-2/5" />
        <SkeletonLine className="h-3 w-1/4" />
      </div>
      <SkeletonLine className="h-5 w-14" />
    </div>
  );
}

/** N skeleton rows — the default loading state for a list. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export interface EmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/** A calm, teaching empty state with an optional pair of call-to-action buttons. */
export function EmptyState({
  title,
  hint,
  actions = [],
  tone = 'muted',
}: {
  title: string;
  hint?: string;
  actions?: EmptyAction[];
  tone?: 'muted' | 'clear';
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-8 text-center">
      <span className={tone === 'clear' ? 'text-success' : 'text-muted-foreground'}>
        {tone === 'clear' ? (
          <CheckCircleIcon className="h-8 w-8" />
        ) : (
          <SparkleIcon className="h-8 w-8" />
        )}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {actions.map((a) =>
            a.href ? (
              <Link
                key={a.label}
                href={a.href}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {a.label}
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                {a.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A compact error note with a Retry that re-runs the hook's refetch. */
export function ErrorNote({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium hover:bg-destructive/20"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * The consistent "AI is working…" card shown while a specialist agent fills in a
 * pending row (a document being analyzed, a research/triage/brief/share pending).
 */
export function AIWorking({
  agent = 'The specialist',
  label = 'Working…',
  hint = 'This usually takes ~30s. This page updates automatically.',
}: {
  agent?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-agent/30 bg-agent/5 p-4">
      <span className="mt-0.5 text-agent motion-safe:animate-pulse">
        <SparkleIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">
          {agent} · <span className="text-agent">{label}</span>
        </p>
        <p className="text-sm text-muted-foreground">{hint}</p>
        <SkeletonLine className="h-3 w-3/4" />
        <SkeletonLine className="h-3 w-1/2" />
      </div>
    </div>
  );
}

type ChipLevel =
  | 'emergency'
  | 'urgent'
  | 'routine'
  | 'self_care'
  | 'high'
  | 'low'
  | 'normal'
  | 'critical'
  | 'info'
  | 'unknown'
  | string;

const CHIP_CLASSES: Record<string, string> = {
  emergency: 'bg-destructive text-destructive-foreground',
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-destructive text-destructive-foreground',
  urgent: 'bg-warning text-warning-foreground',
  low: 'bg-warning text-warning-foreground',
  routine: 'bg-muted text-muted-foreground',
  info: 'bg-accent text-accent-foreground',
  self_care: 'bg-success text-success-foreground',
  normal: 'bg-success text-success-foreground',
};

/**
 * One token-driven status chip that unifies flag / severity / urgency across the
 * app, carrying an accessible label (not just a hue).
 */
export function StatusChip({ level, label }: { level: ChipLevel; label?: string }) {
  const cls = CHIP_CLASSES[level] ?? 'bg-muted text-muted-foreground';
  const text = (label ?? String(level)).replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase ${cls}`}
      aria-label={`Status: ${text}`}
    >
      {text}
    </span>
  );
}
