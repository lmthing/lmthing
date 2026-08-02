/**
 * Private-alpha access gate for lmthing.com.
 *
 * Until {@link ALPHA_LAUNCH_TS} the public site is invite-only: the sign-in
 * surface (`/login`, `/signup`) and the landing CTAs are locked unless the
 * visitor supplies the invite code. After that instant the gate removes itself
 * — every check below is wrapped in {@link isAlphaActive}, so post-launch the
 * site behaves exactly as it did before the alpha period, with no cleanup.
 *
 * The invite code is never stored in this bundle. Only its SHA-256 digest
 * ({@link ALPHA_INVITE_HASH}) is, and the one comparison site
 * ({@link verifyInviteCode}) hashes the supplied value and compares digests.
 */

/** SHA-256 hex digest of the invite code. The plaintext lives only in the invite
 * email we send — never in the UI / shipped JS. */
export const ALPHA_INVITE_HASH =
  'c94a9618b6b4e3fba7c50ad253d3ad2718d74369d1c0daf41255757384c62dc6'

/** Public-launch instant (UTC). Once `Date.now()` passes this, the gate is off. */
export const ALPHA_LAUNCH_TS = Date.parse('2027-01-01T00:00:00Z')

/** localStorage key recording that this browser has already been let in. */
const ALPHA_UNLOCK_KEY = 'lmt_alpha_unlocked'

/** True only during the invite-only period (before launch). */
export function isAlphaActive(): boolean {
  return Date.now() < ALPHA_LAUNCH_TS
}

/**
 * True when this browser may see the locked surfaces: after launch, or once it
 * has been unlocked via the invite code.
 *
 * Reads only the persisted flag — never the code — so it stays synchronous and
 * can be called during render.
 */
export function isAlphaUnlocked(): boolean {
  if (!isAlphaActive()) return true
  try {
    return localStorage.getItem(ALPHA_UNLOCK_KEY) === '1'
  } catch {
    // localStorage can throw in private mode / disabled storage.
    return false
  }
}

/** Record that this browser is invited (persists across reloads until launch). */
export function unlockAlpha(): void {
  try {
    localStorage.setItem(ALPHA_UNLOCK_KEY, '1')
  } catch {
    // Storage unavailable; the caller still reloads, and the URL `?code=` keeps
    // the visitor unlocked for the rest of this navigation.
  }
}

/** The raw `?code=` value from the current URL, or `null`. */
export function codeInUrl(): string | null {
  return new URLSearchParams(window.location.search).get('code')
}

/** SHA-256 hex digest of `input`, or `null` when Web Crypto is unavailable. */
async function sha256Hex(input: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * The single place the invite code is checked. Hashes the supplied value and
 * compares digests — it never compares plaintext. Fails closed (returns
 * `false`) when hashing is unavailable (e.g. an insecure context; prod is HTTPS
 * so `crypto.subtle` is present).
 */
export async function verifyInviteCode(input: string): Promise<boolean> {
  const hash = await sha256Hex(input.trim())
  return hash !== null && hash === ALPHA_INVITE_HASH
}
