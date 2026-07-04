import React from 'react';
import type { DocumentExtraction } from '@app/types';

export function ExtractionList({ extractions }: { extractions: DocumentExtraction[] }) {
  if (!extractions || extractions.length === 0) {
    return <p className="text-sm text-muted-foreground">No extractions yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {extractions.map((ex) => (
        <li
          key={ex.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <span className="text-sm text-foreground">
            {ex.targetTable} <span className="text-muted-foreground">#{ex.rowId}</span>
          </span>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
            {Math.round(ex.confidence * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export default ExtractionList;
