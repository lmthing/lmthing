import React from 'react';

/**
 * A small card the analyst shows after processing one document — "N rows extracted from a
 * <kind> document" plus, when known, a per-table breakdown (e.g. `{ lab_results: 4, metrics: 1 }`)
 * so the reader can see at a glance what kind of data was found.
 */
export function ExtractionSummary({
  documentKind,
  rows,
  byTable,
}: {
  documentKind: string;
  rows: number;
  byTable?: Record<string, number>;
}) {
  const entries = byTable ? Object.entries(byTable).filter(([, count]) => count > 0) : [];

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-sm font-semibold text-foreground">
        {rows} row{rows === 1 ? '' : 's'} extracted
      </div>
      <div className="mt-1 text-xs text-muted-foreground">from a {documentKind.replace(/_/g, ' ')} document</div>
      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map(([table, count]) => (
            <span
              key={table}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {table.replace(/_/g, ' ')}: {count}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ExtractionSummary;
