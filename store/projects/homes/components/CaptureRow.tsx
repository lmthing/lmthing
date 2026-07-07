import React from 'react';
import type { RawCapture } from '@app/types';
import { MarkdownBody } from './MarkdownBody';
import { formatDateTime } from './format';

function StatusPill({ capture }: { capture: RawCapture }) {
  if (capture.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
        pending
      </span>
    );
  }
  if (capture.status === 'parsing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-agent">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-agent" />
        parsing…
      </span>
    );
  }
  if (capture.status === 'error') {
    return (
      <span className="rounded-full border border-destructive px-2 py-0.5 text-xs text-destructive">
        error
      </span>
    );
  }
  const n = capture.listingsFound ?? 0;
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
      {n} listing{n === 1 ? '' : 's'}
    </span>
  );
}

const PARSE_STEPS = ['segmenting', 'extracting', 'deduping', 'summarizing'];

export function CaptureRow({
  capture,
  onRetry,
}: {
  capture: RawCapture;
  onRetry?: (content: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <StatusPill capture={capture} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDateTime(capture.capturedAt)}
        </span>
      </div>

      {capture.status === 'parsing' ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {PARSE_STEPS.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 ? <span className="text-muted-foreground/60">→</span> : null}
              <span>{s}</span>
            </React.Fragment>
          ))}
        </div>
      ) : null}

      <p className="line-clamp-2 text-sm text-muted-foreground">{capture.content}</p>

      {capture.status === 'error' ? (
        <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/5 p-2.5">
          {capture.error ? <p className="text-sm text-destructive">{capture.error}</p> : null}
          {onRetry ? (
            <button
              type="button"
              onClick={() => onRetry(capture.content)}
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Retry parsing
            </button>
          ) : null}
        </div>
      ) : null}

      {capture.status === 'parsed' && capture.summary ? (
        <MarkdownBody source={capture.summary} />
      ) : null}
    </div>
  );
}
