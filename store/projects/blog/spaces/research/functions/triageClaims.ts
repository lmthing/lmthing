const CLAIM_VERBS = /\b(is|are|will|found|reported|according|shows|confirmed|announced|revealed)\b/i;
const MAX_CLAIMS = 5;

/**
 * Split an article body into sentences and pick out the ones most worth fact-checking — those
 * containing a digit (a stat, date, or figure) or a claim-signaling verb ("is/are/will/found/
 * reported/according/..."). Returns at most 5, in original order, so the fact-checker spends its
 * effort on the load-bearing claims rather than every sentence in the piece.
 */
export function triageClaims(body: string): string[] {
  if (!body) return [];

  const sentences = body
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const trimmed = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

  const claimLike = trimmed.filter((s) => /\d/.test(s) || CLAIM_VERBS.test(s));

  return claimLike.slice(0, MAX_CLAIMS);
}
