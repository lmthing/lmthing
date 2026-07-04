/**
 * Pull a start/end date pair out of free text, handling the handful of date formats real
 * confirmations and itineraries actually use: ISO (`2027-03-04`), long form (`March 4, 2027` /
 * `4 March 2027`), and common slashed numeric forms (`03/04/2027`). Returns ISO `YYYY-MM-DD`
 * strings when a date is found; a missing side is simply omitted rather than guessed.
 */
export function parseTripDates(text: string): { start?: string; end?: string } {
  const t = text ?? '';
  const found = new Set<string>();

  // ISO dates are unambiguous — always trust these first.
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    found.add(`${m[1]}-${m[2]}-${m[3]}`);
  }

  // Long-form dates: "March 4, 2027" or "4 March 2027".
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  const monthNames = Object.keys(months).join('|');
  const longForm1 = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi');
  for (const m of t.matchAll(longForm1)) {
    const mm = months[m[1].toLowerCase()];
    const dd = m[2].padStart(2, '0');
    found.add(`${m[3]}-${mm}-${dd}`);
  }
  const longForm2 = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})\\b`, 'gi');
  for (const m of t.matchAll(longForm2)) {
    const mm = months[m[2].toLowerCase()];
    const dd = m[1].padStart(2, '0');
    found.add(`${m[3]}-${mm}-${dd}`);
  }

  // Slashed numeric dates (`03/04/2027`) — ambiguous between MM/DD and DD/MM without more context,
  // so only accept these when no unambiguous form was already found, and prefer the MM/DD/YYYY
  // reading (the more common convention in booking-confirmation English text); when the first
  // number is > 12 it can only be a day, so fall back to DD/MM/YYYY for that case.
  if (found.size === 0) {
    for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = m[3];
      const month = a > 12 ? b : a;
      const day = a > 12 ? a : b;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        found.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    }
  }

  const sorted = Array.from(found).sort();
  if (sorted.length === 0) return {};
  if (sorted.length === 1) return { start: sorted[0] };
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}
