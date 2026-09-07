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
 */
const LOGO_COLORS = ['#f5c815', '#f9a94a', '#f38358', '#ed92a1', '#d59ec8'] // logo-1..5, @lmthing/css tokens.json — frozen wordmark hues, never the palette
const LETTERS = ['l', 'm', 't', 'h', 'i', 'n', 'g']
// The 5 frozen hues are for the mark's own "thing" lettering per tokens.json; "lm" (the platform
// prefix) uses the muted-foreground token so the wordmark reads as one word without claiming a
// 6th/7th brand hue that doesn't exist.
const LM_PREFIX_COLOR = 'var(--lmthing-muted-foreground, #5c636b)'

function LmthingBrandMark({ size, className }) {
  const px = typeof size === 'number' ? size : 20
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#15505c" />
      <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#ffffff">
        lm
      </text>
    </svg>
  )
}

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

/** Required service: the UI slot registry (matches dsh-client-ui-brand-official's own inject). */
export const inject = ['slots']

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  injectBrandColors()
  // priority: -1 — confirmed live this is required: registering with no priority at all collided
  // with dsh-client-ui-brand-official's own registration ("already has a registration at priority
  // 0 ... register at a different priority to shadow it (lowest renders)"). Lower wins per that
  // same error message, so -1 shadows the shipped default (0).
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, LmthingBrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name', priority: -1 }, LmthingWordmark)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -1 }, LmthingBrandMark)
      }),
    ),
  )
}
