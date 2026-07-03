/**
 * "Install to my pod" client for the store app-detail page
 * (`store/src/routes/apps/$appId.tsx`).
 *
 * The install endpoint (`POST /api/apps/install { appId }`) lives on the
 * user's in-pod CLI server (`libs/cli/src/server/routes/apps.ts`, Phase 10A),
 * not on this public static SPA's origin. Routing an authenticated cross-origin
 * request from the public store site to a specific user's pod is production
 * infrastructure (Envoy JWT + per-user routing, per
 * `sdk/org/project-as-application-implementation.md` §0.6 "Where each piece
 * runs") that is **deferred** — not implemented here.
 *
 * Until that's wired, `POD_API_BASE` is a configurable override so this page
 * still works end-to-end against a directly reachable pod (local dev, a
 * same-origin proxy, or a manually-copied pod URL). It defaults to `''`
 * (same-origin), matching every other cross-app `fetch` base in this
 * monorepo (see `space/src/lib/api.ts`, `com/src/lib/cloud.ts`).
 */
export const POD_API_BASE: string = import.meta.env.VITE_POD_API_BASE ?? ''

export interface InstallAppResult {
  /** `true` when the pod responded 2xx. */
  ok: boolean
  status: number
  /** Parsed JSON body, or `null` when the response wasn't valid JSON. */
  body: unknown
}

/**
 * POST `{ appId }` to `${POD_API_BASE}/api/apps/install` on the configured pod.
 * Never throws for a non-2xx HTTP response (reflected in `ok`/`status`/`body`);
 * network-level failures (unreachable pod, CORS) reject — callers should catch.
 */
export async function installApp(appId: string): Promise<InstallAppResult> {
  const res = await fetch(`${POD_API_BASE}/api/apps/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId }),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { ok: res.ok, status: res.status, body }
}
