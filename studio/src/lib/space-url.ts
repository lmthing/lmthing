/**
 * Utilities for building space URLs.
 *
 * Route pattern (pod-only): /[projectId]/[spaceId]/...
 *
 * The "studio" concept is renamed to "project" everywhere, usernames come from
 * the auth session (not the URL), and all spaces live on the pod's PVC (no more
 * storageId / local / github).
 */

/** Build the space URL path from a project id and a space id. */
export function buildSpacePath(projectId: string, spaceId: string): string {
  return `/${encodeURIComponent(projectId)}/${encodeURIComponent(spaceId)}`
}
