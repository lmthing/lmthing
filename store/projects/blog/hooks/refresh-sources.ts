// hooks/refresh-sources.ts — imperative cron handler (no LLM/agent session, no AI credits).
//
// Every 30 minutes: load active `sources`, fetch each `rss`-kind source's feed URL, parse the
// RSS/Atom entries out of the raw XML/Atom body, dedupe against URLs already recorded as
// `raw_items`, and insert only genuinely new items. This reproduces the `rss` path of the
// `newsroom/fetcher#refresh` agent action (spaces/newsroom/tasklists/refresh/) in plain
// deterministic code — fetching + parsing + deduping a feed needs no model judgment, so it no
// longer spins up an agent session on a 30-minute cron. The logic below is inlined verbatim
// from spaces/newsroom/functions/{parseFeedEntries,dedupeByUrl,extractImage}.ts (a hook cannot
// import a space's functions, so they're copied here rather than referenced).
//
// `kind: 'search'` sources (a standing web-search query, not a feed) are intentionally NOT
// polled by this handler — running a live web search needs the `webSearch` capability, which
// only exists inside an agent session, not a plain Node hook handler. Those sources fall back
// to being refreshed only via the interactive "check my feed now" chat path, which still runs
// the live `newsroom/fetcher` agent (spaces/newsroom/agents/fetcher) — left untouched by this
// change. This is a real behavior change (search-kind sources no longer auto-refresh every 30
// minutes) but not a regression in judgment: the original cron pass didn't apply any LLM
// filtering to search results either, it just inserted whatever `webSearch` returned.
//
// One source's failure (dead feed URL, timeout, non-2xx, unparseable body) must not sink the
// batch — each source is fetched independently and wrapped in try/catch, same as the agent
// tasklist's `optional: true` fan-out task.

const FETCH_TIMEOUT_MS = 15_000;

interface SourceRow {
  id: string;
  kind: string;
  value: string;
  active?: boolean;
}

interface RawItemRow {
  url: string;
}

interface FeedEntry {
  title: string;
  url: string;
  excerpt?: string;
}

interface AsyncDb {
  query: (table: string, opts?: { where?: Record<string, unknown> }) => Promise<any[]>;
  insert: (table: string, value: Record<string, unknown>) => Promise<unknown>;
  update: (table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }) => Promise<number>;
}

// ── inlined from spaces/newsroom/functions/parseFeedEntries.ts ─────────────────────────────
// Lenient RSS/Atom parser. Feeds in the wild are inconsistently well-formed, so this extracts
// entries with regex rather than requiring a full, strict XML parse — it degrades to an empty
// array on anything that doesn't look like a feed instead of throwing.
function parseFeedEntries(xml: string): FeedEntry[] {
  if (!xml || typeof xml !== 'string') return [];

  // RSS uses <item>...</item>; Atom uses <entry>...</entry>. Try RSS first, fall back to Atom.
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  const entries: FeedEntry[] = [];

  for (const block of blocks) {
    const title = extractTag(block, 'title');
    const url = extractLink(block);
    if (!title || !url) continue; // skip anything we can't ground in an actual title + url

    const excerpt = extractTag(block, 'description') ?? extractTag(block, 'summary') ?? extractTag(block, 'content');
    entries.push(excerpt ? { title, url, excerpt } : { title, url });
  }

  return entries;
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return undefined;
  const text = cleanText(match[1]);
  return text.length > 0 ? text : undefined;
}

function extractLink(block: string): string | undefined {
  // RSS: <link>https://example.com/post</link>
  const rssLink = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (rssLink && rssLink[1].trim()) return cleanText(rssLink[1]);

  // Atom: <link rel="alternate" href="https://example.com/post" /> (or no rel attribute at all)
  const atomLinks = [...block.matchAll(/<link\b([^>]*)\/?>/gi)];
  for (const m of atomLinks) {
    const attrs = m[1];
    if (!/rel=/i.test(attrs) || /rel=["']alternate["']/i.test(attrs)) {
      const href = attrs.match(/href=["']([^"']+)["']/i);
      if (href) return href[1].trim();
    }
  }

  // Last resort: a <guid> that is itself a real permalink URL.
  const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  if (guid && /^https?:\/\//i.test(guid[1].trim())) return guid[1].trim();

  return undefined;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ── inlined from spaces/newsroom/functions/dedupeByUrl.ts ──────────────────────────────────
// Drop items whose `url` is already known or duplicated within this batch itself, preserving
// order of first occurrence. `knownUrls` is treated as read-only.
function dedupeByUrl<T extends { url: string }>(items: T[], knownUrls: Set<string>): T[] {
  const seen = new Set<string>(knownUrls);
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }

  return result;
}

// ── inlined from spaces/newsroom/functions/extractImage.ts ─────────────────────────────────
// Pull the first plausible lead image URL out of a blob of html/excerpt text — an Open Graph
// `og:image` meta tag if present, otherwise the first `<img src>`. Returns `undefined` (never a
// fabricated placeholder) when nothing looks like an image URL.
function extractImage(html: string | undefined): string | undefined {
  if (!html) return undefined;

  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) return ogMatch[1].trim();

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1].trim();

  return undefined;
}

// ── fetch one rss-kind source, tolerating any failure ───────────────────────────────────────
async function fetchFeedXml(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return undefined;
    return await res.text();
  } catch {
    // network error, timeout, or an unfetchable URL — skip, don't sink the batch
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  type: 'cron',
  every: '30m',
  budget: { maxWallClockMs: 120000 },
  handler: async ({ db }: { db: AsyncDb }) => {
    const sources = (await db.query('sources')) as SourceRow[];
    const active = sources.filter((s) => s.active !== false && s.kind === 'rss');

    // Shared known-url set — updated as each source's fresh items are inserted, so two sources
    // that happen to reference the same URL don't both try to insert it (the `raw_items.url`
    // unique constraint is the real backstop; the per-insert try/catch below tolerates it if a
    // race slips through anyway).
    const known = new Set(((await db.query('raw_items')) as RawItemRow[]).map((r) => r.url));

    await Promise.all(
      active.map(async (source) => {
        const xml = await fetchFeedXml(source.value);
        if (xml === undefined) return; // fetch failed — skip this source, others still run

        const candidates = parseFeedEntries(xml);
        const fresh = dedupeByUrl(candidates, known);

        for (const entry of fresh) {
          known.add(entry.url);
          try {
            await db.insert('raw_items', {
              sourceId: source.id,
              title: entry.title,
              url: entry.url,
              excerpt: entry.excerpt,
              // extractImage resolves to undefined when nothing looks like an image — never invent one
              imageUrl: extractImage(entry.excerpt),
            });
          } catch {
            // e.g. a unique-url race with a concurrent source — not a batch failure
          }
        }

        try {
          await db.update('sources', {
            where: { id: source.id },
            set: { lastFetchedAt: new Date().toISOString() },
          });
        } catch {
          // best-effort bookkeeping — a failed timestamp write shouldn't fail the run
        }
      }),
    );
  },
};
