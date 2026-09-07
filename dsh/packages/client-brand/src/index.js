/**
 * Host half of @lmthing/dsh-client-brand — a genuine no-op, matching this track's established
 * convention for browser-only client plugins (see e.g. client-space-components/src/index.js): all
 * real behavior ships via exports['./client'] (src/client.jsx), never here.
 */
export const name = 'lmthing-client-brand'
export function apply() {}
