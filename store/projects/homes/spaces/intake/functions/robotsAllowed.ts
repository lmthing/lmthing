/**
 * Parse a fetched robots.txt and answer whether a path is allowed for our user
 * agent. Conservative by design: on a disallow the clipper sets the source's
 * `blockedReason` and AUTO-DISABLES polling (surfaced to the user, never silently
 * retried — spec §polling opt-in & self-limiting).
 *
 * Honors the `User-agent: *` group (and an explicit `lmthing` group if the site
 * names one), longest-match Allow/Disallow precedence per the de-facto standard.
 * Empty/absent robots.txt ⇒ allowed. See `listing-parsing/polling-and-politeness`.
 */
export function robotsAllowed(
  robotsTxt: string,
  path: string,
  userAgent = 'lmthing',
): { allowed: boolean; rule?: string } {
  const text = String(robotsTxt ?? '');
  if (!text.trim()) return { allowed: true };

  const groups = parseGroups(text);
  const group =
    groups.find((g) => g.agents.includes(userAgent.toLowerCase())) ??
    groups.find((g) => g.agents.includes('*'));
  if (!group) return { allowed: true };

  const target = normalizePath(path);
  let best: { allow: boolean; len: number; rule: string } | null = null;
  for (const rule of group.rules) {
    if (matches(target, rule.path)) {
      const len = rule.path.length;
      if (!best || len > best.len) best = { allow: rule.allow, len, rule: `${rule.allow ? 'Allow' : 'Disallow'}: ${rule.path}` };
    }
  }
  if (!best) return { allowed: true };
  return { allowed: best.allow, rule: best.rule };
}

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

function parseGroups(text: string): Group[] {
  const lines = text.split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
  const groups: Group[] = [];
  let current: Group | null = null;
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
      else if (key === 'disallow') { /* empty Disallow = allow all — no rule */ }
    }
  }
  return groups;
}

function matches(path: string, rule: string): boolean {
  // Support the `*` wildcard and `$` end-anchor.
  const anchored = rule.endsWith('$');
  const pattern = (anchored ? rule.slice(0, -1) : rule)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp('^' + pattern + (anchored ? '$' : ''));
  return re.test(path);
}

function normalizePath(p: string): string {
  try {
    return new URL(p).pathname || '/';
  } catch {
    return p.startsWith('/') ? p : '/' + p;
  }
}
