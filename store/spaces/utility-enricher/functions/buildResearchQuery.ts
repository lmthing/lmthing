/**
 * Build the web-search query for one blank cell — pure, deterministic, never throws.
 *
 * Shape: `<label> <humanized singular table> <humanized column>`, e.g.
 * `Eiffel Tower landmark height meters` for `landmarks.height_meters` on the row labelled
 * "Eiffel Tower". The table is singularized because a row is ONE of the things the table holds —
 * "landmarks height" reads like a list, "landmark height" reads like a fact.
 *
 * Humanization: `snake_case`, `kebab-case` and `camelCase` all become spaced lowercase words.
 * Singularization is deliberately naive (strip a trailing `s` from tokens longer than 3 chars) —
 * it is a search string, not grammar; a wrong "addres" costs nothing, a hidden dependency on an
 * inflection library costs everything (space functions are injected standalone).
 *
 * The label is the first non-empty value among `labelColumns`, falling back to `name`/`title`/
 * `label`, and finally to `id <id>` so the query still identifies the row.
 *
 * @returns The collapsed single-line query, or `''` for malformed input.
 */
export function buildResearchQuery(
  tableName: unknown,
  row: Record<string, unknown> | null | undefined,
  column: unknown,
  labelColumns?: string[] | null,
): string {
  const table = typeof tableName === 'string' ? tableName.trim() : '';
  const col = typeof column === 'string' ? column.trim() : '';
  if (table === '' || col === '') return '';

  const humanize = (s: string): string =>
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const singularize = (s: string): string =>
    s
      .split(' ')
      .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
      .join(' ');

  const source = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const candidates: string[] = [];
  if (Array.isArray(labelColumns)) {
    for (const c of labelColumns) if (typeof c === 'string' && c !== '') candidates.push(c);
  }
  candidates.push('name', 'title', 'label');

  let label = '';
  for (const c of candidates) {
    const v = source[c];
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue; // never stringify a nested object into a search query
    const s = String(v).trim();
    if (s !== '') { label = s; break; }
  }
  if (label === '') {
    const rawId = source['id'];
    if (typeof rawId === 'string' || typeof rawId === 'number') {
      const id = String(rawId).trim();
      if (id !== '') label = `id ${id}`;
    }
  }

  return `${label} ${singularize(humanize(table))} ${humanize(col)}`.replace(/\s+/g, ' ').trim();
}
