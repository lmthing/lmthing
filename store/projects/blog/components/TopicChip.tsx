import React from 'react';

export interface TopicLike {
  id: string;
  slug: string;
  label?: string;
  followed?: boolean;
  muted?: boolean;
  weight?: number;
  articleCount?: number;
}

export function TopicChip({
  topic,
  onToggleFollow,
  onToggleMute,
  onWeight,
  onRemove,
}: {
  topic: TopicLike;
  onToggleFollow?: () => void;
  onToggleMute?: () => void;
  onWeight?: (weight: number) => void;
  onRemove?: () => void;
}) {
  const weight = topic.weight ?? 1;
  const pct = Math.max(0, Math.min(100, (weight / 3) * 100));

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{topic.label || topic.slug}</span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            #{topic.slug}
          </span>
          {topic.muted ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              muted
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">{topic.articleCount ?? 0} articles</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <button
            type="button"
            onClick={() => onWeight?.(Math.max(0, +(weight - 0.5).toFixed(1)))}
            className="rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:bg-muted"
          >
            −
          </button>
          <span className="w-6 text-center text-xs text-muted-foreground">{weight.toFixed(1)}</span>
          <button
            type="button"
            onClick={() => onWeight?.(+(weight + 0.5).toFixed(1))}
            className="rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:bg-muted"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleFollow}
          className={
            topic.followed
              ? 'rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground'
              : 'rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted'
          }
        >
          {topic.followed ? 'Following' : 'Follow'}
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          {topic.muted ? 'Unmute' : 'Mute'}
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-muted"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
