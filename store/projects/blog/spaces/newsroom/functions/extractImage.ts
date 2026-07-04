/**
 * Pull the first plausible lead image URL out of a blob of html/excerpt text — an Open Graph
 * `og:image` meta tag if present, otherwise the first `<img src>`. Returns `undefined` (never a
 * fabricated placeholder) when nothing looks like an image URL.
 */
export function extractImage(html: string | undefined): string | undefined {
  if (!html) return undefined;

  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch) return ogMatch[1].trim();

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1].trim();

  return undefined;
}
