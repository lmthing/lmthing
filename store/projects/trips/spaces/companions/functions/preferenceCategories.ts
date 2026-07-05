/**
 * The `traveler_preferences.category` enum, and a normalizer that maps common free-text synonyms
 * onto it. Keeping this centralized means the host, the planner, and the packer all bucket a
 * preference like "wheelchair accessible" or "gluten-free" into the same category consistently.
 */
export const PREFERENCE_CATEGORIES = ['diet', 'mobility', 'interest', 'pace', 'budget', 'other'] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];

/**
 * Map a free-text category hint to one of `PREFERENCE_CATEGORIES`, falling back to `'other'` when
 * nothing matches. Callers that already have a properly-typed category should skip this and use it
 * directly — this is a backfill for loosely-typed input (e.g. a category guessed from prose).
 */
export function normalizeCategory(x: string): PreferenceCategory {
  const v = (x ?? '').trim().toLowerCase();
  if ((PREFERENCE_CATEGORIES as readonly string[]).includes(v)) return v as PreferenceCategory;

  const dietKeywords = ['diet', 'food', 'allerg', 'vegetarian', 'vegan', 'gluten', 'kosher', 'halal', 'eat'];
  if (dietKeywords.some((k) => v.includes(k))) return 'diet';

  const mobilityKeywords = ['mobility', 'wheelchair', 'accessib', 'walk', 'stairs', 'hike', 'knee', 'joint'];
  if (mobilityKeywords.some((k) => v.includes(k))) return 'mobility';

  const paceKeywords = ['pace', 'slow', 'fast', 'relax', 'packed', 'rush'];
  if (paceKeywords.some((k) => v.includes(k))) return 'pace';

  const budgetKeywords = ['budget', 'cost', 'splurge', 'cheap', 'expensive', 'money'];
  if (budgetKeywords.some((k) => v.includes(k))) return 'budget';

  const interestKeywords = ['interest', 'museum', 'hobby', 'love', 'enjoy', 'like', 'nightlife', 'nature'];
  if (interestKeywords.some((k) => v.includes(k))) return 'interest';

  return 'other';
}
