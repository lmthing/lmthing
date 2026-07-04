/**
 * Confirms (or corrects) an uploaded document's `kind` from its filename and raw text — the
 * analyst calls this before extracting, since a user-supplied filename or a client-side guess can
 * be wrong. Returns one of `'wearable_csv' | 'lab_pdf' | 'med_label' | 'note_text' | 'other'`.
 *
 * Heuristics are checked in order, most distinctive first:
 * 1. A `.csv` filename, or content that is comma-heavy with a header-ish first line, is a wearable
 *    export.
 * 2. Lab-report vocabulary ("mg/dL", "reference range", "panel", "specimen") signals a lab report.
 * 3. Medication-label vocabulary ("tablet", "mg", "once daily", "prescription", "refill") signals
 *    a med label.
 * 4. Anything else with readable text falls back to a free-form note; genuinely empty/unreadable
 *    content falls back to `'other'`.
 */
export function detectKind(filename: string, content: string): string {
  const name = (filename ?? '').toLowerCase();
  const text = content ?? '';
  const textLower = text.toLowerCase();

  if (name.endsWith('.csv')) return 'wearable_csv';

  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const firstLineCommas = (firstLine.match(/,/g) ?? []).length;
  const looksLikeHeader = /kind|value|unit|recorded/i.test(firstLine);
  if (firstLineCommas >= 2 && looksLikeHeader) return 'wearable_csv';

  const labKeywords = ['mg/dl', 'mmol/l', 'reference range', 'ref range', 'panel', 'specimen', 'analyte'];
  if (labKeywords.some((kw) => textLower.includes(kw))) return 'lab_pdf';

  const medKeywords = ['tablet', 'capsule', 'once daily', 'twice daily', 'prescription', 'refill', 'rx#', 'rx #'];
  if (medKeywords.some((kw) => textLower.includes(kw)) || /\b\d+\s?mg\b/.test(textLower)) return 'med_label';

  if (textLower.trim().length > 0) return 'note_text';

  return 'other';
}
