import React from 'react';
import type { KnowledgeNote } from '@app/types';

export function KnowledgeNoteCard({ note }: { note: KnowledgeNote }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-foreground">{note.topic}</h3>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
          {note.sourceKind}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm text-foreground">{note.body}</div>
      {note.analyte || note.tag ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {note.analyte ? <span>Analyte: {note.analyte}</span> : null}
          {note.tag ? <span>Tag: {note.tag}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default KnowledgeNoteCard;
