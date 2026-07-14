/** Runtime configuration — all from env, sourced from lmthing-secrets in prod. */

const PREFIX = '/scenario-dash'

export const config = {
  PORT: Number(process.env.PORT) || 3000,
  PREFIX,
  /** Shared secret gating both viewer (browser) and ingest (client). */
  DASH_VIEW_TOKEN: process.env.DASH_VIEW_TOKEN || '',
  /** HS256 gateway JWT secret — lets the app mint tokens to wake/status pods. */
  GATEWAY_JWT_SECRET: process.env.GATEWAY_JWT_SECRET || '',
  /** Gateway origin for wake/status (compute lifecycle). */
  GATEWAY_BASE_URL: process.env.GATEWAY_BASE_URL || 'https://lmthing.cloud',
  /**
   * How the app reaches a user pod's /api (fs/sessions).
   *  - '' (empty) in-cluster: http://lmthing.user-<id>.svc.cluster.local:8080 (no token)
   *  - a public origin (local dev): https://lmthing.chat (needs a gateway JWT per call)
   */
  POD_EDGE_BASE: process.env.POD_EDGE_BASE || '',
  /** Served-app origin. In-cluster = the pod DNS (root-mounted app); local dev = https://lmthing.app. */
  POD_APP_BASE: process.env.POD_APP_BASE || '',
  /** Where the built SPA lives (relative to cwd). */
  UI_DIST: process.env.UI_DIST || 'ui-dist',
}

export function podBaseUrl(userId: string): string {
  if (config.POD_EDGE_BASE) return config.POD_EDGE_BASE
  return `http://lmthing.user-${userId}.svc.cluster.local:8080`
}

/** In local-dev (POD_EDGE_BASE set) calls need a gateway JWT; in-cluster they do not. */
export function podNeedsToken(): boolean {
  return !!config.POD_EDGE_BASE
}

/** Origin of the SERVED app for a user (root-mounted <projectId>/*). */
export function appBaseUrl(userId: string): string {
  if (config.POD_APP_BASE) return config.POD_APP_BASE
  return podBaseUrl(userId)
}
