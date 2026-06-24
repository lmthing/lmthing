/**
 * Local navigation path helpers for the pod-backed, drill-down nav:
 *   `/`            → projects list (landing)
 *   `/$projectId`  → a project's spaces
 *   `/$projectId/$spaceId` → a space editor
 *
 * Previously the ui lib reached into the studio app via `@/lib/space-url`
 * (which carried `$username` and `$storageId` segments). The pod-backed
 * architecture collapses those, so the lib now owns a tiny self-contained
 * helper and the studio app decides exact path wiring.
 */

function enc(segment: string): string {
  return encodeURIComponent(segment)
}

/** `/$projectId` — the spaces listing for a project. */
export function buildProjectPath(projectId: string | null | undefined): string {
  if (!projectId) return '/'
  return `/${enc(projectId)}`
}

/** `/$projectId/$spaceId` — a space editor (SpaceProvider hydrates). */
export function buildSpacePath(
  projectId: string | null | undefined,
  spaceId: string | null | undefined,
): string {
  if (!projectId) return '/'
  if (!spaceId) return buildProjectPath(projectId)
  return `/${enc(projectId)}/${enc(spaceId)}`
}
