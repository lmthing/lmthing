/** One row of a parsed wearable CSV export, ready to insert into `metrics`. */
export interface CsvRow {
  kind: string;
  value: number;
  unit: string;
  recordedAt: string;
}

/**
 * Parses a wearable-device CSV export (`documents.content` for a `wearable_csv` document) into
 * rows shaped for `metrics`. The expected column order is `kind,value,unit,recordedAt` — e.g.
 * `weight,72.4,kg,2026-06-30T07:00:00Z`. A first line containing the literal word `kind` is
 * treated as a header and skipped; anything else is treated as data from line one.
 *
 * Deliberately conservative: blank lines, short lines (fewer than 4 columns), rows with an empty
 * `kind`, and rows whose `value` doesn't coerce to a finite number are dropped rather than
 * guessed at — the analyst should never insert a metric it can't actually support from the text.
 */
export function parseCsv(text: string): CsvRow[] {
  const lines = (text ?? '').split(/\r?\n/);
  if (lines.length === 0) return [];

  const hasHeader = lines[0].toLowerCase().includes('kind');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: CsvRow[] = [];
  for (const line of dataLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split(',').map((c) => c.trim());
    if (cols.length < 4) continue;

    const [kind, rawValue, unit, recordedAt] = cols;
    if (!kind) continue;

    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    rows.push({ kind, value, unit: unit ?? '', recordedAt: recordedAt ?? '' });
  }

  return rows;
}
