/**
 * Small presentation helpers shared across the blog pages. Pure functions —
 * no design tokens or JSX here (styling lives in the components that call these).
 */

/** A compact relative time like "just now", "6m ago", "3h ago", "2d ago". */
export function relativeTime(value: string | number | Date | undefined | null): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/** Try to derive a readable host label from a URL (e.g. "example.com"). */
export function hostLabel(url: string | undefined | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Clamp a raw relevance score into 0..3 filled segments for the meter. */
export function scoreSegments(score: number | undefined | null): number {
  const s = typeof score === 'number' ? score : 0;
  if (s <= 0) return 0;
  if (s < 1) return 1;
  if (s < 2.5) return 2;
  return 3;
}

/** Title-case a slug or short label ("small-modular-reactors" → "Small Modular Reactors"). */
export function humanize(slug: string | undefined | null): string {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
