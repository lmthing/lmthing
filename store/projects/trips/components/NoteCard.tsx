import React from 'react';
import type { KnowledgeNote } from '@app/types';
import { MarkdownBody } from './MarkdownBody';

export function NoteCard({ note }: { note: KnowledgeNote }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold text-foreground">{note.topic}</span>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {note.sourceKind}
        </span>
      </div>
      <MarkdownBody source={note.body ?? ''} />
    </div>
  );
}
