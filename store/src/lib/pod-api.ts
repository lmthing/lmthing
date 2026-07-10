/**
 * "Install to my pod" hand-off for the store app-detail page
 * (`store/src/routes/projects/$appId.tsx`).
 *
 * The install endpoint (`POST /api/apps/install { appId }`) lives on the user's
 * in-pod CLI server and requires the user's authenticated pod context, which this
 * PUBLIC static store site does not have. So installing redirects to the
 * **lmthing.app install page** (`/install?appId=<id>`) — served by the unified app
 * shell on the user's authenticated pod surface — which performs the install with
 * the user's Bearer token and then opens the app. Base overridable at build time via
 * `VITE_APP_BASE_URL` (defaults to the production `https://lmthing.app`).
 */
export const APP_BASE_URL: string = import.meta.env.VITE_APP_BASE_URL ?? 'https://lmthing.app'

/** The lmthing.app install-page URL that installs `appId` into the signed-in user's pod. */
export function installUrlForApp(appId: string): string {
  return `${APP_BASE_URL}/install?appId=${encodeURIComponent(appId)}`
}

/**
 * lmthing.studio base — where integration *spaces* are installed. Unlike
 * project-apps (installed on lmthing.app), integrations are installed
 * **per-project** from the Studio project view's in-app install panel (it runs
 * in the user's authenticated pod context, which this public store can't reach).
 * The store's role for spaces is discovery + a hand-off to Studio. Overridable at
 * build time via `VITE_STUDIO_BASE_URL` (defaults to `https://lmthing.studio`).
 */
export const STUDIO_BASE_URL: string = import.meta.env.VITE_STUDIO_BASE_URL ?? 'https://lmthing.studio'

/** Open Studio to install `spaceId`. Studio's project view carries the in-app
 *  install panel that lists every store integration (including this one) and
 *  installs it into the selected project. The `install` query param is a
 *  forward-looking hint for surfacing this specific integration. */
export function studioInstallUrlForSpace(spaceId: string): string {
  return `${STUDIO_BASE_URL}/studio?install=${encodeURIComponent(spaceId)}`
}
