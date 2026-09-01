/**
 * RFC-4180-shaped CSV parser with delimiter auto-detection — pure, never throws.
 *
 * Handles what real exports actually contain: quoted fields with embedded delimiters, newlines and
 * doubled quotes (`""` → `"`), a UTF-8 BOM, CRLF, blank lines, and ragged rows (padded or
 * truncated to the header width, and counted so a caller can report them honestly rather than
 * silently mangling data).
 *
 * The delimiter is chosen by scanning the first few lines for the candidate that yields the most
 * CONSISTENT column count — a comma-heavy free-text column cannot outvote a real semicolon
 * delimiter that way.
 *
 * @returns `{ headers, rows, raggedRows, delimiter }`; a blank or unparseable input degrades to
 *          `{ headers: [], rows: [], raggedRows: 0, delimiter: ',' }`.
 */
export function parseCsvRows(text: unknown): {
  headers: string[];
  rows: Record<string, string>[];
  raggedRows: number;
  delimiter: string;
} {
  const EMPTY = { headers: [] as string[], rows: [] as Record<string, string>[], raggedRows: 0, delimiter: ',' };
  if (typeof text !== 'string') return EMPTY;

  let src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (src.trim() === '') return EMPTY;

  /** Split one delimited document into rows of fields, honouring quotes. */
  const splitAll = (input: string, delim: string): string[][] => {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
        continue;
      }
      if (ch === '"') { inQuotes = true; continue; }
      if (ch === delim) { row.push(field); field = ''; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += ch;
    }
    row.push(field);
    rows.push(row);
    // Drop trailing blank rows (a file ending in a newline).
    while (rows.length > 0 && rows[rows.length - 1]!.every((f) => f.trim() === '')) rows.pop();
    return rows;
  };

  // Delimiter detection: most consistent column count over the first 5 parsed rows, tie → most columns.
  const candidates = [',', ';', '\t', '|'];
  let delimiter = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const probe = splitAll(src, d).slice(0, 5);
    if (probe.length === 0) continue;
    const width = probe[0]!.length;
    if (width < 2) continue; // a single column means this delimiter never actually split anything
    const consistent = probe.filter((r) => r.length === width).length;
    const score = consistent * 100 + width;
    if (score > bestScore) { bestScore = score; delimiter = d; }
  }

  const grid = splitAll(src, delimiter).filter((r) => !(r.length === 1 && r[0]!.trim() === ''));
  if (grid.length === 0) return EMPTY;

  const headers = grid[0]!.map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  let raggedRows = 0;

  for (const cells of grid.slice(1)) {
    if (cells.length !== headers.length) raggedRows++;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    rows.push(row);
  }

  return { headers, rows, raggedRows, delimiter };
}
