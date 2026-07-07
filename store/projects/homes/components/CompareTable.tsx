import React from 'react';

interface CompareRow {
  attribute: string;
  values: (string | number)[];
}

export function CompareTable({
  rows,
  titles,
}: {
  rows: CompareRow[];
  titles: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 min-w-[140px] bg-card px-4 py-2.5 text-left font-semibold text-foreground">
              Attribute
            </th>
            {titles.map((title, i) => (
              <th
                key={i}
                className="min-w-[160px] px-4 py-2.5 text-left font-semibold text-foreground"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i > 0 ? 'border-t border-border' : undefined}>
              <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium text-muted-foreground">
                {row.attribute}
              </td>
              {row.values.map((v, j) => (
                <td key={j} className="px-4 py-2 text-foreground">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
