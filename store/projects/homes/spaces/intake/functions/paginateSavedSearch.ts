/**
 * Find the per-result "card" blocks and the next-page URL in a fetched
 * saved-search results page. Bounded: never returns more than `maxCards` cards or
 * signals more than the poll's page budget. Deterministic heuristic over raw HTML
 * (no DOM) — the clipper fetches each card's link, or parses the card text inline.
 *
 * A results page is a list of listing links with prices near them; we segment on
 * anchor tags whose surrounding text carries a price. `nextPageUrl` is the
 * rel="next" link or a `?page=N+1`/`&pagina=` pattern. See
 * `listing-parsing/polling-and-politeness`.
 */
export interface SavedSearchPage {
  cards: { url: string; text: string }[];
  nextPageUrl: string | null;
}

const PRICE = /[€£$]\s?\d|\d[\d.,\s]{2,}\s?(?:€|£|\$|eur|gbp)/i;

export function paginateSavedSearch(html: string, opts?: { maxCards?: number }): SavedSearchPage {
  const raw = String(html ?? '');
  const maxCards = Math.max(1, Math.min(opts?.maxCards ?? 40, 60));

  const cards: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  const anchors = raw.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const a of anchors) {
    const href = a[1];
    // A listing link usually points at a detail path and its neighborhood mentions a price.
    const around = raw.slice(Math.max(0, a.index ?? 0), (a.index ?? 0) + 600);
    if (!PRICE.test(around)) continue;
    if (!/\/(imovel|listing|property|anuncio|for-sale|to-rent|arrenda|venda|detail)/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    cards.push({ url: href, text: stripTags(around).slice(0, 400) });
    if (cards.length >= maxCards) break;
  }

  const nextRel = raw.match(/<a[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i) ??
    raw.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i);
  const nextPageUrl = nextRel ? nextRel[1] : null;

  return { cards, nextPageUrl };
}

function stripTags(s: string): string {
  return String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
