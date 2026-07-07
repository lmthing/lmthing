import React from 'react';
import type { TasteNote } from '@app/types';
import { MarkdownBody } from './MarkdownBody';

export function TasteNoteCard({ note }: { note: TasteNote }) {
  const pct = Math.round(Math.max(0, Math.min(1, note.weight ?? 0)) * 100);

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
          {note.dimension}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {note.supportCount} signal{note.supportCount === 1 ? '' : 's'}
        </span>
      </div>

      <MarkdownBody source={note.statement ?? ''} />

      <div className="h-1.5 w-full rounded-full bg-muted" title={`weight ${pct}%`}>
        <div className="h-1.5 rounded-full bg-agent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
