/**
 * Split a pasted alert-email body (Idealista/Imovirtual/Rightmove-style "N new
 * listings match your search" digests) into per-listing candidate blocks.
 *
 * Deterministic, heuristic, portal-idiom aware — the clipper feeds each block to
 * `extractListingFields`. We DON'T parse fields here; we only segment. Strategy:
 *   1. Primary boundary: blank lines. Digests separate each listing card with a
 *      blank line (or a separator rule like `----` / `===`), so a run of non-blank
 *      lines is one card. This keeps a card's title, price, size, and link together
 *      (titles sit ABOVE the price in these emails — a naive price-anchor split
 *      would shear them apart).
 *   2. Fallback: if the whole body is one blank-line-free blob (a pasted results
 *      list), split on a price anchor so at least each price starts a card.
 *   3. Keep only blocks that actually carry a price — headers/footers drop out.
 *
 * See `listing-parsing/portals-and-alert-emails`.
 */
const BOILERPLATE = /^\s*(unsubscribe|manage (your )?alert|privacy policy|do not reply|©|all rights reserved|update your preferences|view (this|the) email)/i;
const SEPARATOR = /^\s*([-=_*·—–]{3,}|•{1,})\s*$/;
const PRICE_ANCHOR = /([€£$]\s?\d|\d[\d.,\s]*\s?(?:€|£|\$|eur|gbp|usd)|\bper month\b|\/m[êe]s\b|\bpcm\b)/i;

export function parseAlertEmail(body: string): string[] {
  const rawLines = String(body ?? '').replace(/\r\n/g, '\n').split('\n');

  const rawBlocks: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) rawBlocks.push(current);
    current = [];
  };

  for (const raw of rawLines) {
    const line = raw.trim();
    if (line === '' || SEPARATOR.test(line)) {
      flush();
      continue;
    }
    if (BOILERPLATE.test(line)) continue;
    current.push(line);
  }
  flush();

  let blocks = rawBlocks.map((b) => b.join('\n').trim());

  // Fallback: a single big blob with no blank-line structure but many prices →
  // segment on price anchors so each price begins a card.
  const priced = blocks.filter((b) => PRICE_ANCHOR.test(b));
  if (priced.length <= 1 && blocks.length) {
    const merged = blocks.join('\n');
    const priceCount = (merged.match(new RegExp(PRICE_ANCHOR, 'gi')) ?? []).length;
    if (priceCount > 1) blocks = splitOnPriceAnchor(merged);
  }

  return blocks.filter((b) => b.length > 0 && PRICE_ANCHOR.test(b));
}

function splitOnPriceAnchor(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (PRICE_ANCHOR.test(line) && cur.some((l) => l.length > 12)) {
      out.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) out.push(cur);
  return out.map((b) => b.join('\n'));
}
