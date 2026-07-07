// Maps an itinerary item `kind` to a design-token color + tone class, so the
// timeline can color-code items without ever writing a raw color. The border
// stripe uses the CSS variable directly (a token, not a literal color); badges
// use the matching text-* utility.

export interface KindStyle {
  /** CSS variable for the left stripe (a design token, e.g. 'var(--agent)'). */
  colorVar: string;
  /** Tailwind text-* token utility for the kind badge. */
  toneClass: string;
  /** Short human label. */
  label: string;
}

const MAP: Record<string, KindStyle> = {
  activity: { colorVar: 'var(--agent)', toneClass: 'text-agent', label: 'activity' },
  sightseeing: { colorVar: 'var(--agent)', toneClass: 'text-agent', label: 'sightseeing' },
  meal: { colorVar: 'var(--warning)', toneClass: 'text-warning', label: 'meal' },
  food: { colorVar: 'var(--warning)', toneClass: 'text-warning', label: 'food' },
  transit: { colorVar: 'var(--primary)', toneClass: 'text-primary', label: 'transit' },
  transport: { colorVar: 'var(--primary)', toneClass: 'text-primary', label: 'transit' },
  lodging: { colorVar: 'var(--accent)', toneClass: 'text-accent', label: 'lodging' },
  hotel: { colorVar: 'var(--accent)', toneClass: 'text-accent', label: 'lodging' },
};

const FALLBACK: KindStyle = {
  colorVar: 'var(--muted-foreground)',
  toneClass: 'text-muted-foreground',
  label: 'other',
};

export function kindStyle(kind?: string): KindStyle {
  if (!kind) return FALLBACK;
  return MAP[kind.toLowerCase()] ?? { ...FALLBACK, label: kind };
}
