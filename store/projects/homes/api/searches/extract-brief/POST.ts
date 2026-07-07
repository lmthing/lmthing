type Row = Record<string, unknown>;
interface Db {
  query(table: string, opts?: { where?: Record<string, unknown>; include?: string[]; orderBy?: string | { column: string; dir?: 'asc' | 'desc' }; limit?: number; offset?: number }): Promise<Row[]>;
  insert(table: string, values: Row | Row[]): Promise<Row | Row[]>;
  update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number>;
  remove(table: string, opts: { where: Record<string, unknown> }): Promise<number>;
}
type Ctx = {
  db: Db;
  spawn: (ref: string, input?: unknown, opts?: { onError?: (e: unknown) => void }) => Promise<{ runId: string }>;
  apiCall: (name: string, input?: unknown) => Promise<unknown>;
};

export const name = 'extractSearchBrief';
export const description = 'Turn a free-text home-search brief into an editable structured draft (mode, area, min rooms/size, budget, must-haves, commute hints). Deterministic first pass the user confirms/edits before creating the search — never fills a field it cannot find in the text.';

export interface Input {
  /** The user's plain-English description of what they want. */
  brief: string;
}

export interface CommuteHint {
  label: string;
  address: string;
  mode: string;
  maxMinutes: number;
}

export interface Output {
  mode?: 'rent' | 'buy';
  area?: string;
  budgetMax?: number;
  currency?: string;
  minRooms?: number;
  minAreaSqm?: number;
  mustHaves: string[];
  commuteTargets: CommuteHint[];
}

// Keyword → canonical must-have. Kept conservative — we only surface a chip when
// the brief clearly mentions it, and the user edits before it becomes a constraint.
const MUST_HAVE_HINTS: [RegExp, string][] = [
  [/\belevator|lift\b/i, 'elevator'],
  [/\bbalcon(y|ies)\b/i, 'balcony'],
  [/\bterrace\b/i, 'terrace'],
  [/\bparking|garage\b/i, 'parking'],
  [/\bpets?\b/i, 'pets allowed'],
  [/\bfurnished\b/i, 'furnished'],
  [/\bgarden\b/i, 'garden'],
  [/\bpool\b/i, 'pool'],
  [/\bbright|lots of light|sunny\b/i, 'bright'],
  [/\bquiet\b/i, 'quiet street'],
  [/\bdishwasher\b/i, 'dishwasher'],
  [/\bair.?con|a\/c\b/i, 'air conditioning'],
];

const CURRENCY_HINT: [RegExp, string][] = [
  [/€|eur\b/i, 'EUR'],
  [/£|gbp\b/i, 'GBP'],
  [/\$|usd\b/i, 'USD'],
];

const MODE_GUESS: [RegExp, string][] = [
  [/\bwalk(ing)? to\b/i, 'walk'],
  [/\bcycle|bike|biking\b/i, 'bike'],
  [/\bdriv(e|ing)|by car\b/i, 'drive'],
];

/** Parse a money-ish token → integer amount (handles 1.600, 1,600, 450k). */
function parseAmount(raw: string): number {
  let s = raw.toLowerCase().replace(/[^0-9.,k]/g, '');
  const k = /k$/.test(s);
  s = s.replace(/k$/, '');
  // Strip thousands separators (either . or ,), keep the last group only as integer.
  s = s.replace(/[.,]/g, '');
  let n = Number(s);
  if (!Number.isFinite(n)) return 0;
  if (k) n *= 1000;
  return Math.round(n);
}

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  void ctx;
  const text = (input.brief ?? '').trim();
  const out: Output = { mustHaves: [], commuteTargets: [] };
  if (!text) return out;

  const lower = text.toLowerCase();

  // Mode: buy vs rent.
  if (/\b(buy|buying|purchase|mortgage|for sale)\b/.test(lower)) out.mode = 'buy';
  else if (/\b(rent|renting|monthly|per month|\/mo|to let)\b/.test(lower)) out.mode = 'rent';

  // Currency.
  for (const [re, code] of CURRENCY_HINT) {
    if (re.test(text)) {
      out.currency = code;
      break;
    }
  }

  // Budget — first "under/up to/max €X" style figure, else the largest money token.
  const budgetMatch = text.match(/(?:under|below|up to|max(?:imum)?|budget of|around|<)\s*[€£$]?\s*([0-9][0-9.,]*\s*k?)/i);
  if (budgetMatch) {
    const amt = parseAmount(budgetMatch[1]);
    if (amt > 0) out.budgetMax = amt;
  } else {
    const moneyTokens = [...text.matchAll(/[€£$]\s*([0-9][0-9.,]*\s*k?)/g)].map((m) => parseAmount(m[1]));
    if (moneyTokens.length) out.budgetMax = Math.max(...moneyTokens);
  }

  // Rooms / bedrooms — "2-bed", "T2", "3 rooms", "two bedroom".
  const bedMatch = lower.match(/\b(?:t|t-)?(\d+)\s*-?\s*(?:bed|bedroom|bdr)\b/) || lower.match(/\bt(\d)\b/);
  if (bedMatch) {
    const n = Number(bedMatch[1]);
    if (n > 0) out.minRooms = n + 1; // a T2 / 2-bed implies ≥3 rooms incl. living
  } else {
    const roomMatch = lower.match(/\b(\d+)\s*rooms?\b/);
    if (roomMatch) out.minRooms = Number(roomMatch[1]);
  }

  // Minimum size — "at least 70 m²", "70m2", "min 80 sqm".
  const areaMatch = lower.match(/(\d{2,4})\s*(?:m²|m2|sqm|square meters?)/);
  if (areaMatch) out.minAreaSqm = Number(areaMatch[1]);

  // Area — after "in <Place>" up to a comma/end, capitalized. Best-effort.
  const areaHint = text.match(/\bin\s+([A-ZÀ-Ý][\wÀ-ÿ'’-]+(?:[ ,][A-ZÀ-Ý][\wÀ-ÿ'’-]+){0,3})/);
  if (areaHint) out.area = areaHint[1].replace(/[,\s]+$/, '').trim();

  // Must-haves.
  for (const [re, tag] of MUST_HAVE_HINTS) {
    if (re.test(text) && !out.mustHaves.includes(tag)) out.mustHaves.push(tag);
  }

  // Commute hints — "X min to <place>" / "walk to <place>".
  const commuteRe = /(\d{1,3})\s*-?\s*min(?:ute)?s?\s+(?:to|from)\s+(?:the\s+)?([A-Za-zÀ-ÿ][\wÀ-ÿ' ]{2,30})/gi;
  for (const m of text.matchAll(commuteRe)) {
    const label = m[2].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    let mode = 'transit';
    for (const [re, md] of MODE_GUESS) {
      if (re.test(m[0])) {
        mode = md;
        break;
      }
    }
    if (!out.commuteTargets.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      out.commuteTargets.push({ label, address: label, mode, maxMinutes: Number(m[1]) || 30 });
    }
  }
  // Also catch "walk to <place>" with no minutes → default 20 min walk.
  for (const m of text.matchAll(/\bwalk(?:ing)?\s+to\s+(?:the\s+)?([A-Za-zÀ-ÿ][\wÀ-ÿ' ]{2,30})/gi)) {
    const label = m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    if (!out.commuteTargets.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      out.commuteTargets.push({ label, address: label, mode: 'walk', maxMinutes: 20 });
    }
  }

  return out;
}
