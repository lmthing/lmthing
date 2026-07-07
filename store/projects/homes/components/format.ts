// Small, self-contained display helpers shared across lmthing.homes.
// No Intl currency APIs relied on for money — a manual symbol map keeps
// amounts readable and deterministic across the three supported currencies.

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

/** Money with a currency symbol + en-US thousands grouping, whole units (no cents). */
export function formatMoney(amount: number, currency?: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = (currency || 'USD').toUpperCase();
  const symbol = SYMBOLS[code] ?? `${code} `;
  return `${symbol}${Math.round(value).toLocaleString('en-US')}`;
}

/** 'dated_kitchen' -> 'Dated kitchen'. 'poor_light' -> 'Poor light'. */
export function humanizeSlug(slug: string): string {
  const words = (slug ?? '').replace(/_/g, ' ').trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface Parts {
  y: number;
  m: number; // 1-12
  d: number;
  hh?: number;
  mm?: number;
}

function parse(iso?: string | null): Parts | null {
  if (!iso) return null;
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const parts: Parts = { y: Number(y), m: Number(m), d: Number(d) };
  if (hh !== undefined) {
    parts.hh = Number(hh);
    parts.mm = Number(mm);
  }
  return parts;
}

/** '2026-07-07' -> 'Jul 7, 2026'. Returns '' for empty/invalid. */
export function formatDate(iso?: string | null): string {
  const p = parse(iso);
  if (!p) return '';
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

/** '2026-07-07T14:32:00Z' -> 'Jul 7, 14:32'. Falls back to date-only. */
export function formatDateTime(iso?: string | null): string {
  const p = parse(iso);
  if (!p) return '';
  const date = `${MONTHS[p.m - 1]} ${p.d}`;
  if (p.hh === undefined) return `${date}, ${p.y}`;
  const hh = String(p.hh).padStart(2, '0');
  const mm = String(p.mm ?? 0).padStart(2, '0');
  return `${date}, ${hh}:${mm}`;
}

/**
 * Score band — turns a 0..100 match score into a word + a design token, so the
 * badge encodes meaning (not just a number) and colorblind users get a label.
 * <45 is "capped" (a hard constraint or dealbreaker held it down).
 */
export interface ScoreBand {
  word: string;
  /** design-token text class */
  tone: string;
  hint: string;
}
export function scoreBand(score: number): ScoreBand {
  const v = Number.isFinite(score) ? score : 0;
  if (v <= 0) return { word: 'scoring', tone: 'text-muted-foreground', hint: 'Not yet ranked' };
  if (v >= 80) return { word: 'strong', tone: 'text-success', hint: 'Strong match — act fast' };
  if (v >= 60) return { word: 'worth a look', tone: 'text-agent', hint: 'Worth a look' };
  if (v >= 45) return { word: 'weak', tone: 'text-muted-foreground', hint: 'Weak match' };
  return { word: 'capped', tone: 'text-destructive', hint: 'Capped by a hard constraint' };
}

/** Inline glyphs for commute modes — no icon dependency needed. */
export const MODE_GLYPH: Record<string, string> = {
  transit: '🚆',
  walk: '🚶',
  bike: '🚴',
  drive: '🚗',
};
