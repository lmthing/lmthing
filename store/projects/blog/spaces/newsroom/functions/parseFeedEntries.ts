/**
 * Lenient RSS/Atom parser. Feeds in the wild are inconsistently well-formed, so this extracts
 * entries with regex rather than requiring a full, strict XML parse — it degrades to an empty
 * array on anything that doesn't look like a feed instead of throwing.
 */
export function parseFeedEntries(xml: string): { title: string; url: string; excerpt?: string }[] {
  if (!xml || typeof xml !== 'string') return [];

  // RSS uses <item>...</item>; Atom uses <entry>...</entry>. Try RSS first, fall back to Atom.
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  const entries: { title: string; url: string; excerpt?: string }[] = [];

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
