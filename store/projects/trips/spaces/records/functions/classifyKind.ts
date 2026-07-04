/**
 * Guess a document's kind from its free text, as a starting point for the analyst to confirm or
 * correct against the client-provided `documents.kind` guess. Heuristic keyword/pattern matching —
 * not authoritative, just a reasonable first pass over messy pasted text.
 */
export function classifyKind(
  text: string,
): 'booking_pdf' | 'ticket_image' | 'itinerary' | 'passport_visa' | 'place_photo' | 'other' {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return 'other';

  // Passport/visa mentions are the most specific signal and should win even if the text also
  // mentions a flight (a visa page often quotes the traveller's onward flight for context).
  const passportVisaHits = [
    /passport/, /\bvisa\b/, /schengen/, /\bexpiry date\b/, /date of issue/, /place of birth/,
    /nationality/, /entry stamp/, /immigration/,
  ].filter((re) => re.test(t)).length;
  if (passportVisaHits >= 2) return 'passport_visa';

  // A confirmation/reservation code plus provider language strongly suggests a single booking.
  const confirmationHits = [
    /confirmation (number|code|#)/, /reservation (number|code|#)/, /booking (reference|number|id)/,
    /\bpnr\b/, /e-ticket number/, /check-?in date/, /check-?out date/,
  ].filter((re) => re.test(t)).length;

  // Multi-segment / multi-day language suggests a forwarded itinerary rather than one booking.
  const itineraryHits = [
    /day 1\b/i, /\bitinerary\b/, /multiple segments/, /connecting flight/, /layover/,
    /\bleg \d/i, /day-by-day/,
  ].filter((re) => re.test(t)).length;

  const flightHits = [
    /\bflight\b/, /\bdeparture\b/, /\barrival\b/, /gate\b/, /boarding pass/, /seat \d/,
  ].filter((re) => re.test(t)).length;

  if (itineraryHits > 0 && (flightHits > 0 || /hotel|train|bus|ferry/.test(t))) return 'itinerary';
  if (confirmationHits > 0) return 'booking_pdf';
  if (flightHits >= 2) return 'ticket_image';

  // A short, largely non-textual-looking blob (few sentence-ending punctuation marks relative to
  // length) reads more like a caption on a photo than a document with real content.
  const sentenceEnders = (t.match(/[.!?]/g) ?? []).length;
  if (t.length > 0 && t.length < 200 && sentenceEnders === 0) return 'place_photo';

  return 'other';
}
