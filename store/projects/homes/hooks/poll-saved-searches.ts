/**
 * Imperative, no-LLM cron: fetch each due, opted-in `saved_search` source
 * (robots-aware, throttled) and ingest results as new `raw_captures`.
 *
 * This used to declaratively delegate to `intake/clipper#poll` — but that
 * action was always pure fetch+parse orchestration over plain-TS functions (no
 * LLM judgment), so running it through an agent session just burned tokens for
 * nothing. It now runs in-proc via an imperative `handler`, no agent session,
 * no LLM.
 *
 * The dedupe/canonicalize/taste-rank work that DOES need the LLM is untouched —
 * this hook only ever inserts `pending` raw_captures; the `parse-new-capture`
 * database hook (still an agent delegate into `intake/clipper`'s parse action)
 * is what turns a capture into a canonical listing.
 *
 * Logic below is inlined verbatim from spaces/intake/functions/
 * {robotsAllowed,politeFetchPlan,paginateSavedSearch}.ts — keep those functions
 * and this copy in sync if either changes (the space functions remain the
 * source of truth / are still unit-tested independently; this hook can't
 * `import` them because hook modules are loaded standalone, not bundled).
 */

// ── inlined: spaces/intake/functions/politeFetchPlan.ts ────────────────────
interface PollableSource {
  id: string;
  url?: string;
  pollEnabled?: boolean;
  pollIntervalHours?: number;
  lastPolledAt?: string | null;
  blockedReason?: string | null;
  pollRequestedAt?: string | null;
}

interface FetchPlanEntry {
  sourceId: string;
  url: string;
  host: string;
  earliestAtMs: number;
  maxPages: number;
}

const MIN_INTERVAL_HOURS = 6;
const PER_HOST_SPACING_MS = 20_000;
const HARD_PAGE_CAP = 12;
const PER_SOURCE_PAGES = 3;

function politeFetchPlan(
  sources: PollableSource[],
  now: number,
  opts?: { jitterMs?: number },
): FetchPlanEntry[] {
  const jitter = opts?.jitterMs ?? 5_000;
  const due = (sources ?? []).filter((s) => {
    if (!s.url || s.blockedReason) return false;
    const lastMs = s.lastPolledAt ? Date.parse(s.lastPolledAt) : NaN;
    if (s.pollRequestedAt) {
      const reqMs = Date.parse(s.pollRequestedAt);
      if (Number.isFinite(reqMs) && (!Number.isFinite(lastMs) || reqMs > lastMs)) return true;
    }
    if (!s.pollEnabled) return false;
    const interval = Math.max(MIN_INTERVAL_HOURS, s.pollIntervalHours ?? 12) * 3_600_000;
    if (!s.lastPolledAt) return true;
    return !Number.isFinite(lastMs) || now - lastMs >= interval;
  });

  const lastHostAt = new Map<string, number>();
  const plan: FetchPlanEntry[] = [];
  let pagesUsed = 0;

  for (const s of due) {
    if (pagesUsed >= HARD_PAGE_CAP) break;
    const host = hostOf(s.url!);
    const prev = lastHostAt.get(host) ?? now;
    const earliest = Math.max(now, prev) + (lastHostAt.has(host) ? PER_HOST_SPACING_MS : 0) + Math.floor(Math.random() * jitter);
    const maxPages = Math.min(PER_SOURCE_PAGES, HARD_PAGE_CAP - pagesUsed);
    plan.push({ sourceId: s.id, url: s.url!, host, earliestAtMs: earliest, maxPages });
    lastHostAt.set(host, earliest);
    pagesUsed += maxPages;
  }

  return plan;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// ── inlined: spaces/intake/functions/robotsAllowed.ts ──────────────────────
function robotsAllowed(
  robotsTxt: string,
  path: string,
  userAgent = 'lmthing',
): { allowed: boolean; rule?: string } {
  const text = String(robotsTxt ?? '');
  if (!text.trim()) return { allowed: true };

  const groups = parseRobotsGroups(text);
  const group =
    groups.find((g) => g.agents.includes(userAgent.toLowerCase())) ??
    groups.find((g) => g.agents.includes('*'));
  if (!group) return { allowed: true };

  const target = normalizeRobotsPath(path);
  let best: { allow: boolean; len: number; rule: string } | null = null;
  for (const rule of group.rules) {
    if (matchesRobotsRule(target, rule.path)) {
      const len = rule.path.length;
      if (!best || len > best.len) best = { allow: rule.allow, len, rule: `${rule.allow ? 'Allow' : 'Disallow'}: ${rule.path}` };
    }
  }
  if (!best) return { allowed: true };
  return { allowed: best.allow, rule: best.rule };
}

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

function parseRobotsGroups(text: string): RobotsGroup[] {
  const lines = text.split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let expectingAgent = false;
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.toLowerCase().trim();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!expectingAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      expectingAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      expectingAgent = false;
      if (!current) { current = { agents: ['*'], rules: [] }; groups.push(current); }
      if (value) current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  return groups;
}

function matchesRobotsRule(path: string, rule: string): boolean {
  const anchored = rule.endsWith('$');
  const pattern = (anchored ? rule.slice(0, -1) : rule)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp('^' + pattern + (anchored ? '$' : ''));
  return re.test(path);
}

function normalizeRobotsPath(p: string): string {
  try {
    return new URL(p).pathname || '/';
  } catch {
    return p.startsWith('/') ? p : '/' + p;
  }
}

// ── inlined: spaces/intake/functions/paginateSavedSearch.ts ────────────────
interface SavedSearchPage {
  cards: { url: string; text: string }[];
  nextPageUrl: string | null;
}

const PRICE_RE = /[€£$]\s?\d|\d[\d.,\s]{2,}\s?(?:€|£|\$|eur|gbp)/i;

function paginateSavedSearch(html: string, opts?: { maxCards?: number }): SavedSearchPage {
  const raw = String(html ?? '');
  const maxCards = Math.max(1, Math.min(opts?.maxCards ?? 40, 60));

  const cards: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  const anchors = raw.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const a of anchors) {
    const href = a[1];
    const around = raw.slice(Math.max(0, a.index ?? 0), (a.index ?? 0) + 600);
    if (!PRICE_RE.test(around)) continue;
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

/** robots.txt only makes sense for a hierarchical (http/https-shaped) URL —
 *  anything else (a `data:` fixture URL in tests, etc.) has no robots.txt
 *  location, so it's treated as unrestricted rather than blocked. */
async function robotsCheckFor(sourceUrl: string): Promise<{ allowed: boolean; rule?: string }> {
  let robotsUrl: string;
  try {
    robotsUrl = new URL('/robots.txt', sourceUrl).toString();
  } catch {
    return { allowed: true };
  }
  const robotsTxt = await fetchText(robotsUrl);
  return robotsAllowed(robotsTxt, sourceUrl);
}

export default {
  type: 'cron',
  every: '6h',
  budget: { maxWallClockMs: 180000 },
  handler: async ({ db }: { db: any }) => {
    const sources: PollableSource[] = await db.query('sources', { where: { kind: 'saved_search' } });
    const plan = politeFetchPlan(sources, Date.now());

    // `plan` is already ordered/spaced per host — walk it in order rather than
    // reordering; no literal sleep is needed within one cron tick.
    for (const entry of plan) {
      const source = sources.find((s) => s.id === entry.sourceId);
      if (!source) continue;

      try {
        const check = await robotsCheckFor(entry.url);
        if (!check.allowed) {
          // STOP on this source entirely — auto-disable, never rotate a user agent or retry around it.
          await db.update('sources', {
            where: { id: source.id },
            set: {
              pollEnabled: false,
              blockedReason: `robots.txt disallows this path (${check.rule ?? 'no matching rule'}) — polling auto-disabled.`,
            },
          });
          continue;
        }

        let url: string | null = entry.url;
        let pagesFetched = 0;
        while (url && pagesFetched < entry.maxPages) {
          const html = await fetchText(url);
          if (!html) break; // a failed/empty fetch this tick — try again next tick, don't sink the source

          const page = paginateSavedSearch(html);
          for (const card of page.cards) {
            // Ordinary raw_captures — the parse-new-capture hook re-enters the same
            // pipeline a pasted email would, so poll results get identical
            // extract/dedupe/merge treatment (still handled by the LLM clipper).
            await db.insert('raw_captures', {
              sourceId: source.id,
              searchId: source.searchId,
              content: card.text,
              sourceUrl: card.url,
              status: 'pending',
            });
          }
          url = page.nextPageUrl;
          pagesFetched++;
        }

        await db.update('sources', { where: { id: source.id }, set: { lastPolledAt: new Date().toISOString() } });
      } catch {
        // One source's fetch/parse failure never sinks the batch — move on.
        continue;
      }
    }
  },
};
