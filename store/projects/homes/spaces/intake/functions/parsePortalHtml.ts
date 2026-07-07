export interface ParsedPortalPage {
  title: string;
  description: string;
  priceAmount: number;
  currency: string;
  areaSqm: number;
  rooms: number;
  bedrooms: number;
  address: string;
  photos: { url: string; caption: string }[];
  fromJsonLd: boolean; // true when the highest-fidelity JSON-LD block was used
}

/**
 * Strip boilerplate from a fetched listing page and pull the structured fields,
 * description, and photo URLs (+ captions). The HIGHEST-fidelity source is a
 * `schema.org/RealEstateListing`/`Residence`/`Product` JSON-LD block when present —
 * we prefer it wholesale over scraped heuristics (spec §scraping toolkit).
 *
 * No DOM: portals are fetched as text, so this is regex/heuristic over raw HTML.
 * Deterministic and unit-testable; the model never fills a gap this leaves empty.
 */
export function parsePortalHtml(html: string): ParsedPortalPage {
  const raw = String(html ?? '');
  const jsonLd = extractJsonLd(raw);
  if (jsonLd) return { ...jsonLd, fromJsonLd: true };

  // ── Fallback: scrape from tags/meta ──
  const title =
    meta(raw, 'og:title') ??
    tag(raw, 'title') ??
    'Untitled listing';
  const description = stripTags(
    meta(raw, 'og:description') ?? tag(raw, 'h1') ?? '',
  ).slice(0, 4000);

  const priceText =
    meta(raw, 'product:price:amount') ??
    (raw.match(/[€£$]\s?[\d.,\s]{2,}|\b\d[\d.,\s]{2,}\s?(?:€|£|\$|eur|gbp)/i) ?? [''])[0];
  const { amount, currency } = parseMoney(priceText);

  const areaMatch = raw.match(/(\d+(?:[.,]\d+)?)\s?(?:m²|m2|sqm)/i);
  const areaSqm = areaMatch ? Math.round(Number(areaMatch[1].replace(',', '.'))) : 0;
  const bedMatch = raw.match(/\bT(\d)\b/i) ?? raw.match(/(\d+)\s?(?:bedrooms?|quartos?)/i);
  const bedrooms = bedMatch ? Number(bedMatch[1]) : 0;

  const address = stripTags(meta(raw, 'og:street-address') ?? '').slice(0, 200);

  const photos = Array.from(
    raw.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi),
  )
    .slice(0, 24)
    .map((m) => ({
      url: m[1],
      caption: (m[0].match(/alt=["']([^"']*)["']/i) ?? ['', ''])[1] ?? '',
    }));

  return {
    title: stripTags(title).slice(0, 140),
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
          const { amount, currency } = parseMoney(
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
            description: stripTags(String(node.description ?? '')).slice(0, 4000),
            priceAmount: amount,
            currency: currency || String(offer.priceCurrency ?? ''),
            areaSqm: Math.round(area),
            rooms: Number(node.numberOfRooms ?? 0) || 0,
            bedrooms: Number(node.numberOfBedrooms ?? 0) || 0,
            address: stripTags(
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

function meta(html: string, prop: string): string | undefined {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRe(prop)}["'][^>]+content=["']([^"']*)["']`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapeRe(prop)}["']`, 'i'));
  return m ? m[1] : undefined;
}
function tag(html: string, name: string): string | undefined {
  const m = html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? stripTags(m[1]).trim() : undefined;
}
function stripTags(s: string): string {
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
function parseMoney(raw: string): { amount: number; currency: string } {
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
