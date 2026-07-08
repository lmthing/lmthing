/**
 * Imperative, no-LLM cron: re-fetch each active search's tracked `listings`
 * (anything not `dismissed`/`gone`) and mark them `gone`, price-changed, or
 * still fine — deterministic fetch + field diff.
 *
 * This used to declaratively delegate to `intake/clipper#refresh` — but that
 * action was always pure fetch+parse+diff over plain-TS functions (no LLM
 * judgment), so running it through an agent session just burned tokens for
 * nothing. It now runs in-proc via an imperative `handler`, no agent session,
 * no LLM.
 *
 * The dedupe/canonicalize/taste-rank work that DOES need the LLM is untouched
 * — this hook never touches `raw_captures` and never re-fires the
 * insert-only `enrich-new-listing` pipeline; `trueCostMonthly`/scoring go
 * slightly stale on a price refresh until something else touches the row —
 * same tradeoff the original agent action made.
 *
 * `parsePortalHtml` is inlined verbatim from
 * spaces/intake/functions/parsePortalHtml.ts (which already carries its own
 * self-contained `parseMoney` twin); `formatMoney` from
 * spaces/intake/functions/formatMoney.ts. Keep those functions and this copy
 * in sync if either changes — hook modules are loaded standalone, not
 * bundled, so this file can't `import` them.
 */

// ── inlined: spaces/intake/functions/parsePortalHtml.ts ────────────────────
interface ParsedPortalPage {
  title: string;
  description: string;
  priceAmount: number;
  currency: string;
  areaSqm: number;
  rooms: number;
  bedrooms: number;
  address: string;
  photos: { url: string; caption: string }[];
  fromJsonLd: boolean;
}

function parsePortalHtml(html: string): ParsedPortalPage {
  const raw = String(html ?? '');
  const jsonLd = extractJsonLd(raw);
  if (jsonLd) return { ...jsonLd, fromJsonLd: true };

  const title =
    metaTag(raw, 'og:title') ??
    plainTag(raw, 'title') ??
    'Untitled listing';
  const description = portalStripTags(
    metaTag(raw, 'og:description') ?? plainTag(raw, 'h1') ?? '',
  ).slice(0, 4000);

  const priceText =
    metaTag(raw, 'product:price:amount') ??
    (raw.match(/[€£$]\s?[\d.,\s]{2,}|\b\d[\d.,\s]{2,}\s?(?:€|£|\$|eur|gbp)/i) ?? [''])[0];
  const { amount, currency } = portalParseMoney(priceText);

  const areaMatch = raw.match(/(\d+(?:[.,]\d+)?)\s?(?:m²|m2|sqm)/i);
  const areaSqm = areaMatch ? Math.round(Number(areaMatch[1].replace(',', '.'))) : 0;
  const bedMatch = raw.match(/\bT(\d)\b/i) ?? raw.match(/(\d+)\s?(?:bedrooms?|quartos?)/i);
  const bedrooms = bedMatch ? Number(bedMatch[1]) : 0;

  const address = portalStripTags(metaTag(raw, 'og:street-address') ?? '').slice(0, 200);

  const photos = Array.from(
    raw.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi),
  )
    .slice(0, 24)
    .map((m) => ({
      url: m[1],
      caption: (m[0].match(/alt=["']([^"']*)["']/i) ?? ['', ''])[1] ?? '',
    }));

  return {
    title: portalStripTags(title).slice(0, 140),
    description,
    priceAmount: amount,
    currency,
    areaSqm,
    rooms: bedrooms > 0 ? bedrooms + 1 : 0,
    bedrooms,
    address,
    photos,
    fromJsonLd: false,
  };
}

function extractJsonLd(html: string): Omit<ParsedPortalPage, 'fromJsonLd'> | null {
  const blocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  );
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed];
      for (const node of nodes) {
        const type = String(node['@type'] ?? '').toLowerCase();
        if (/(realestatelisting|residence|apartment|house|product|offer)/.test(type)) {
          const offer = node.offers ?? node;
          const { amount, currency } = portalParseMoney(
            String(offer.price ?? offer.priceSpecification?.price ?? ''),
          );
          const photos = (Array.isArray(node.image) ? node.image : [node.image])
            .filter(Boolean)
            .slice(0, 24)
            .map((img: unknown) =>
              typeof img === 'string'
                ? { url: img, caption: '' }
                : { url: String((img as Record<string, unknown>)?.url ?? ''), caption: String((img as Record<string, unknown>)?.caption ?? '') },
            )
            .filter((p: { url: string }) => p.url);
          const area = Number(node.floorSize?.value ?? node.floorSize ?? 0) || 0;
          return {
            title: String(node.name ?? 'Untitled listing').slice(0, 140),
            description: portalStripTags(String(node.description ?? '')).slice(0, 4000),
            priceAmount: amount,
            currency: currency || String(offer.priceCurrency ?? ''),
            areaSqm: Math.round(area),
            rooms: Number(node.numberOfRooms ?? 0) || 0,
            bedrooms: Number(node.numberOfBedrooms ?? 0) || 0,
            address: portalStripTags(
              typeof node.address === 'string'
                ? node.address
                : [node.address?.streetAddress, node.address?.addressLocality].filter(Boolean).join(', '),
            ).slice(0, 200),
            photos,
          };
        }
      }
    } catch {
      // not valid JSON-LD — fall through to the next block / heuristics
    }
  }
  return null;
}

function metaTag(html: string, prop: string): string | undefined {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRe(prop)}["'][^>]+content=["']([^"']*)["']`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapeRe(prop)}["']`, 'i'));
  return m ? m[1] : undefined;
}
function plainTag(html: string, name: string): string | undefined {
  const m = html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? portalStripTags(m[1]).trim() : undefined;
}
function portalStripTags(s: string): string {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compact money parse (self-contained twin of the parseMoney function). */
function portalParseMoney(raw: string): { amount: number; currency: string } {
  const text = String(raw ?? '');
  const symbols: Record<string, string> = { '€': 'EUR', '£': 'GBP', '$': 'USD' };
  let currency = '';
  for (const [sym, code] of Object.entries(symbols)) if (text.includes(sym)) { currency = code; break; }
  if (!currency) { const m = text.toUpperCase().match(/\b(EUR|GBP|USD|CHF)\b/); if (m) currency = m[1]; }
  const m = text.match(/\d[\d.,\s ]*\d|\d/);
  if (!m) return { amount: 0, currency };
  let n = m[0].replace(/[\s ]/g, '');
  const hasDot = n.includes('.'), hasComma = n.includes(',');
  if (hasDot && hasComma) {
    const dec = n.lastIndexOf('.') > n.lastIndexOf(',') ? '.' : ',';
    const tho = dec === '.' ? ',' : '.';
    n = n.split(tho).join('').replace(dec, '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = n.split(sep);
    const last = parts[parts.length - 1];
    n = parts.length > 1 && last.length === 3 ? parts.join('') : parts.join('.').replace(/\.(?=.*\.)/g, '');
  }
  const amount = Number(n);
  return { amount: Number.isFinite(amount) ? amount : 0, currency };
}

// ── inlined: spaces/intake/functions/formatMoney.ts ─────────────────────────
const MONEY_SYMBOL: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', JPY: '¥' };

function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const whole = Math.round(n) === n;
  const grouped = n.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sym = MONEY_SYMBOL[(currency ?? '').toUpperCase()];
  return sym ? `${sym}${grouped}` : `${(currency || '').toUpperCase()} ${grouped}`.trim();
}

// ── fetch helper — tolerant, timeout-bounded ────────────────────────────────
const FETCH_TIMEOUT_MS = 15_000;

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export default {
  type: 'cron',
  every: '6h',
  budget: { maxWallClockMs: 180000 },
  handler: async ({ db }: { db: any }) => {
    const searches = await db.query('searches', { where: { status: 'active' } });

    for (const search of searches) {
      const all = await db.query('listings', { where: { searchId: search.id } });
      const tracked = all.filter((l: any) => l.status !== 'dismissed' && l.status !== 'gone');

      for (const listing of tracked) {
        if (!listing.url) continue; // nothing to re-check without a canonical URL

        try {
          const html = await fetchText(listing.url);

          if (!html || html.length < 200) {
            // A near-empty refetch reads as "taken down", not "network hiccup" — the
            // user can always re-paste the listing later if this was transient.
            await db.update('listings', { where: { id: listing.id }, set: { status: 'gone', lastSeenAt: new Date().toISOString() } });
            await db.insert('alerts', {
              searchId: search.id,
              listingId: listing.id,
              kind: 'gone',
              title: `${listing.title} looks like it's been taken down`,
              body: `Refetching ${listing.url} returned no usable content — marking it gone.`,
            });
            continue;
          }

          const fresh = parsePortalHtml(html);
          const priceChanged = fresh.priceAmount > 0 && fresh.priceAmount !== listing.priceAmount;

          // Note: trueCostMonthly is deliberately left as-is here. A price refresh
          // doesn't re-fire the insert-only `enrich-new-listing` pipeline (this is
          // an update, not an insert), so the last-computed true cost goes slightly
          // stale until something else touches the row — an acceptable tradeoff
          // against re-running the whole scout pipeline on every 6h refresh tick.
          await db.update('listings', {
            where: { id: listing.id },
            set: {
              lastSeenAt: new Date().toISOString(),
              ...(priceChanged ? { priceAmount: fresh.priceAmount } : {}),
            },
          });

          if (priceChanged && fresh.priceAmount < listing.priceAmount) {
            await db.insert('alerts', {
              searchId: search.id,
              listingId: listing.id,
              kind: 'price_drop',
              title: `${listing.title} dropped to ${formatMoney(fresh.priceAmount, listing.currency)}`,
              body: `Was ${formatMoney(listing.priceAmount, listing.currency)}, now ${formatMoney(fresh.priceAmount, listing.currency)} — refetched from ${listing.url}.`,
            });
          }
          // A listing that had been `gone` is never in `tracked` above (filtered
          // out), so a `back_online` alert is raised the one place that DOES see
          // gone listings: `poll-saved-searches`, when the same unit resurfaces
          // as a fresh capture and re-dedupes onto this row.
        } catch {
          // One listing's fetch/parse failure never sinks the batch — move on.
          continue;
        }
      }
    }
  },
};
