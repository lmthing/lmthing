/**
 * LMThing branding for the dsh web UI (Part B, see dsh/PROGRESS.md).
 *
 * Slot names and shape confirmed by reading the REAL shipped
 * `@deepseek-ai/dsh-client-ui-brand-official` bundle (`lib/client.js`) byte-for-byte before writing
 * this: it fills `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark`
 * with `OfficialBrandMark({size, className})` / `OfficialBrandName()`. This plugin registers the
 * SAME three slots with LMThing's own mark/wordmark instead — Cordis slots are last-registration-
 * wins for a given name, so this must load AFTER dsh-client-ui-brand-official in the client
 * bundle's plugin order (confirmed live: it does, since it's inserted after brand-official in
 * scripts/assemble-lmthing-profile.mjs's insert list).
 *
 * Colors: `--dsw-alias-brand-primary` is the ONE variable that actually drives the shipped UI's
 * primary accent (confirmed live by reading the real computed stylesheet rules —
 * `--dsw-alias-button-primary-fill: var(--dsw-alias-brand-primary)`, i.e. every primary button
 * traces back to it). Values are @lmthing/css's own `primary`/`primary-foreground` design tokens
 * (sdk/org/libs/css/src/tokens/tokens.json — "Primary/CTA... slate teal (#15505c light / #6aa8b4
 * dark)"), not invented here.
 *
 * Mark + favicon: the small "lmt" mark and the browser-tab favicon both use the REAL LMThing
 * favicon asset (`sdk/org/common/favicon.ico/favicon-96x96.png`) inlined as a data URI — not a
 * hand-drawn recreation. An earlier version of this mark was a solid teal square with plain white
 * "lmt" text; that was this file's own invention, not LMThing's actual mark (confirmed by opening
 * the real asset: transparent background, three individually-coloured letters — coral `l`, orange
 * `m`, gold `t`, sampled directly from the PNG). Embedding the real asset guarantees pixel-fidelity
 * without re-deriving those colors by hand.
 */
const FAVICON_DATA_URI = 'data:image/png;base64,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'

function LmthingBrandMark({ size, className }) {
  const px = typeof size === 'number' ? size : 20
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img src={FAVICON_DATA_URI} width={px} height={px} className={className} style={{ objectFit: 'contain' }} aria-hidden="true" />
  )
}

/**
 * `sidebar.brand.mark` is rendered by `@deepseek-ai/dsh-client-ui-sidebar` from TWO call sites with
 * IDENTICAL props (`{size: 24}`, confirmed live by reading the real shipped `SidebarRoot`'s JSX
 * byte-for-byte) — one inside the expanded "brand row" next to `sidebar.brand.name` (wrapper class
 * matching `*brandMark*`), one as the collapsed rail's own toggle-button icon (wrapper class
 * matching `*railMark*`). Only one of the two ever mounts at a time (dsh's own `wide && (...)` /
 * `!wide && (...)` branches), so there's no prop to key off of — the two call sites are
 * distinguished here by their DIFFERENT ancestor class names instead, purely in CSS (no ref/effect
 * needed, no flash of the wrong state): hidden by default, shown only inside `*railMark*`. Matched
 * by substring, not the exact hashed class, since the hash prefix is a per-build artifact.
 * Per user direction: the mark belongs on the collapsed rail (where it's the only thing standing in
 * for the wordmark); the expanded brand row already carries the full `sidebar.brand.name` wordmark,
 * so a second, redundant mark next to it is dropped there.
 */
const SIDEBAR_MARK_CLASS = 'lmthing-sidebar-mark'
const SIDEBAR_MARK_STYLE_ID = 'lmthing-sidebar-mark-style'

function injectSidebarMarkVisibility() {
  if (document.getElementById(SIDEBAR_MARK_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SIDEBAR_MARK_STYLE_ID
  style.textContent = `
    .${SIDEBAR_MARK_CLASS} { display: none; }
    [class*="railMark"] .${SIDEBAR_MARK_CLASS} { display: inline-flex; }
  `
  document.head.appendChild(style)
}

function LmthingSidebarMark({ size, className }) {
  return (
    <span className={SIDEBAR_MARK_CLASS}>
      <LmthingBrandMark size={size} className={className} />
    </span>
  )
}

const LOGO_COLORS = ['#f5c815', '#f9a94a', '#f38358', '#ed92a1', '#d59ec8'] // logo-1..5, @lmthing/css tokens.json — frozen wordmark hues, never the palette
const LETTERS = ['l', 'm', 't', 'h', 'i', 'n', 'g']
// The 5 frozen hues are for the mark's own "thing" lettering per tokens.json; "lm" (the platform
// prefix) uses the muted-foreground token so the wordmark reads as one word without claiming a
// 6th/7th brand hue that doesn't exist.
const LM_PREFIX_COLOR = 'var(--lmthing-muted-foreground, #5c636b)'

function LmthingWordmark() {
  return (
    <span style={{ fontWeight: 600 }}>
      {LETTERS.map((letter, i) => (
        <span key={i} style={{ color: i < 2 ? LM_PREFIX_COLOR : LOGO_COLORS[i - 2] }}>
          {letter}
        </span>
      ))}
    </span>
  )
}

const BRAND_STYLE_ID = 'lmthing-brand-colors'

function injectBrandColors() {
  if (document.getElementById(BRAND_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = BRAND_STYLE_ID
  style.textContent = `
    body {
      --dsw-alias-brand-primary: #15505c;
      --dsw-alias-brand-primary-invert: #ffffff;
      --lmthing-muted-foreground: #5c636b;
    }
    body[data-ds-dark-theme] {
      --dsw-alias-brand-primary: #6aa8b4;
      --dsw-alias-brand-primary-invert: #101214;
      --lmthing-muted-foreground: #98a0a9;
    }
  `
  document.head.appendChild(style)
}

/**
 * dsh's own index.html ships `<link rel="icon" href="/favicon.svg">` (confirmed live via
 * `document.querySelectorAll('link[rel*="icon"]')`) — there's no slot or config for this, so it's
 * overwritten directly. Repoints every existing icon link at the real LMThing favicon and removes
 * any manifest icon links (the PWA manifest itself is dsh's own and 401s for every user anyway —
 * see dsh/PROGRESS.md — not worth chasing here).
 */
function injectFavicon() {
  const existing = document.querySelectorAll('link[rel*="icon"]')
  if (existing.length > 0) {
    existing.forEach((link) => {
      link.type = 'image/png'
      link.href = FAVICON_DATA_URI
    })
    return
  }
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/png'
  link.href = FAVICON_DATA_URI
  document.head.appendChild(link)
}

/**
 * Suppresses dsh's own "Internal Testing Notice" onboarding step (`@deepseek-ai/dsh-client-ui-
 * settings-models`, `id: "welcome-notice"` under the `settings.onboarding` list slot). It shows on
 * every new session, never durably: that package's `WelcomeNoticeStore` binds through
 * `ctx.settingsScope`, whose persistence is `ctx.remote.$host.isLoopback ? "host" : "memory"`
 * (`@deepseek-ai/dsh-client-connection`'s `client.js`) — `isLoopback` there is a plain
 * `window.location.hostname` check, so every one of our users (always `lmthing.chat`, never
 * `127.0.0.1`) is "memory" mode by design, and the acknowledgement never survives a page reload.
 * That's a deliberate trust boundary (don't let a non-loopback page durably rewrite server-side
 * settings), not a bug — nothing to fix there, and nothing we should try to spoof.
 * No host-side config exists to disable the step (`dsh-client-ui-settings-models`'s host `apply()`
 * is a no-op). Re-registering the SAME `id` under the same list slot replaces the shipped entry
 * rather than adding a second one — confirmed live: this component renders instead of
 * `WelcomeNotice`, and since it returns `null` immediately, the onboarding sequence just skips
 * straight past it.
 */
function NoWelcomeNotice() {
  return null
}

/** Required service: the UI slot registry (matches dsh-client-ui-brand-official's own inject). */
export const inject = ['slots']

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  injectBrandColors()
  injectFavicon()
  injectSidebarMarkVisibility()
  // priority: -1 — confirmed live this is required: registering with no priority at all collided
  // with dsh-client-ui-brand-official's own registration ("already has a registration at priority
  // 0 ... register at a different priority to shadow it (lowest renders)"). Lower wins per that
  // same error message, so -1 shadows the shipped default (0).
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, LmthingSidebarMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name', priority: -1 }, LmthingWordmark)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -1 }, LmthingBrandMark)
      }),
    ),
  )
  ctx.slots.inject('settings.onboarding', () =>
    ctx.slots.register({ name: 'settings.onboarding', id: 'welcome-notice', order: -100 }, NoWelcomeNotice),
  )
}
