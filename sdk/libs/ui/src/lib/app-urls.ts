/**
 * Cross-app URLs for the lmthing product suite (studio / chat / computer).
 *
 * Resolution mirrors @lmthing/auth and computer's `use-tier-detection`:
 *   1. explicit Vite env override (VITE_STUDIO_URL / VITE_CHAT_URL / VITE_COMPUTER_URL)
 *   2. dev  → `<app>.test`
 *   3. prod → `https://lmthing.<app>`
 *
 * These power the cross-app switcher links in the studio and computer shells so
 * users can hop between lmthing.studio, lmthing.chat and lmthing.computer.
 */
export type LmthingApp = 'studio' | 'chat' | 'computer'

interface ViteEnv {
  DEV?: boolean
  VITE_STUDIO_URL?: string
  VITE_CHAT_URL?: string
  VITE_COMPUTER_URL?: string
}

function readEnv(): ViteEnv {
  try {
    return (import.meta as unknown as { env?: ViteEnv }).env ?? {}
  } catch {
    return {}
  }
}

const ENV_KEY: Record<LmthingApp, keyof ViteEnv> = {
  studio: 'VITE_STUDIO_URL',
  chat: 'VITE_CHAT_URL',
  computer: 'VITE_COMPUTER_URL',
}

/** Absolute origin for one of the lmthing apps. */
export function appUrl(app: LmthingApp): string {
  const env = readEnv()
  const override = env[ENV_KEY[app]] as string | undefined
  if (override) return override
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
  return env.DEV ? `${protocol}//${app}.test` : `https://lmthing.${app}`
}

export interface AppLink {
  app: LmthingApp
  label: string
  emoji: string
  url: string
}

const APP_META: Record<LmthingApp, { label: string; emoji: string }> = {
  studio: { label: 'Studio', emoji: '🎛️' },
  chat: { label: 'Chat', emoji: '💬' },
  computer: { label: 'Computer', emoji: '🖥️' },
}

/** Links to the *other* lmthing apps (excludes `current`), for cross-app nav. */
export function otherAppLinks(current: LmthingApp): AppLink[] {
  return (Object.keys(APP_META) as LmthingApp[])
    .filter((app) => app !== current)
    .map((app) => ({ app, ...APP_META[app], url: appUrl(app) }))
}
