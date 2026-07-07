import React from 'react';

interface CompareRow {
  attribute: string;
  values: (string | number)[];
}

// Direction per attribute: does a higher or lower number win? Inferred from the
// attribute label so the table can highlight the best cell in each row.
function direction(attribute: string): 'higher' | 'lower' | null {
  const a = attribute.toLowerCase();
  if (/(cost|price|rent|commute|min|€|\$|£|per m)/.test(a)) return 'lower';
  if (/(size|area|m²|m2|score|rooms|bed|match|year)/.test(a)) return 'higher';
  return null;
}

function numeric(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/[,\s]/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Which column indices win this row (may be several on a tie).
function winners(row: CompareRow): Set<number> {
  const dir = direction(row.attribute);
  if (!dir) return new Set();
  const nums = row.values.map(numeric);
  const present = nums.filter((n): n is number => n !== null);
  if (present.length < 2) return new Set();
  const best = dir === 'higher' ? Math.max(...present) : Math.min(...present);
  const set = new Set<number>();
  nums.forEach((n, i) => {
    if (n !== null && n === best) set.add(i);
  });
  return set;
}

export function CompareTable({
  rows,
  titles,
  highlight = true,
}: {
  rows: CompareRow[];
  titles: string[];
  highlight?: boolean;
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
          {rows.map((row, i) => {
            const win = highlight ? winners(row) : new Set<number>();
            return (
              <tr key={i} className={i > 0 ? 'border-t border-border' : undefined}>
                <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium text-muted-foreground">
                  {row.attribute}
                </td>
                {row.values.map((v, j) => {
                  const isWin = win.has(j);
                  return (
                    <td
                      key={j}
                      className={
                        'px-4 py-2 ' +
                        (isWin ? 'bg-muted font-semibold text-primary' : 'text-foreground')
                      }
                    >
                      {isWin ? '★ ' : ''}
                      {v}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
