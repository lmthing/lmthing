/**
 * Utilities for building and parsing space URLs.
 *
 * Route pattern: /[username]/[studioId]/[storageId]/[spaceId]
 *
 * storageId: "local" | "github"
 * spaceId: plain slug for local, URI-encoded owner%2Frepo for github.
 *
 * The "full" spaceId used internally (in lmthing.json, AppFS paths, etc.)
 * is always "{storageId}/{decodedSpaceId}" — e.g. "local/my-space" or "github/vasilis/repo".
 */

/** Split a full spaceId into storageId and the storage-specific id. */
export function parseSpaceId(fullSpaceId: string): { storageId: string; spaceId: string } {
  const idx = fullSpaceId.indexOf('/')
  if (idx === -1) return { storageId: 'local', spaceId: fullSpaceId }
  return {
    storageId: fullSpaceId.slice(0, idx),
    spaceId: fullSpaceId.slice(idx + 1),
  }
}

/** Reconstruct the full internal spaceId from route params. */
export function buildFullSpaceId(storageId: string, spaceId: string): string {
  return `${storageId}/${storageId === 'github' ? decodeURIComponent(spaceId) : spaceId}`
}

/** Build the URL-safe space path segment: /{storageId}/{spaceId} */
export function spaceSegment(fullSpaceId: string): string {
  const { storageId, spaceId } = parseSpaceId(fullSpaceId)
  if (storageId === 'github') {
    return `/${storageId}/${encodeURIComponent(spaceId)}`
  }
  return `/${storageId}/${spaceId}`
}

/** Build the full space URL path from components. */
export function buildSpacePath(username: string, studioId: string, fullSpaceId: string): string {
  return `/${encodeURIComponent(username)}/${encodeURIComponent(studioId)}${spaceSegment(fullSpaceId)}`
}

/** Build the space URL path from route params (storageId + spaceId already split). */
export function buildSpacePathFromParams(username: string, studioId: string, storageId: string, spaceId: string): string {
  return buildSpacePath(username, studioId, buildFullSpaceId(storageId, spaceId))
}
