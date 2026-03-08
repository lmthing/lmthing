import { colors } from './constants'
import { CozyThingText } from '@/CozyText'

const points = [
  {
    icon: '🔓',
    title: 'Open source, git-native',
    desc: 'Knowledge lives in files you own. No lock-in, no black box. Community builds the long tail.',
  },
  {
    icon: '🏛️',
    title: 'Deploy anywhere',
    desc: 'On-premises, EU-compliant, vendor agnostic. Built for the AI Act era.',
  },
  {
    icon: '🛒',
    title: 'Marketplace',
    desc: 'Publish agents & knowledge. Earn revenue. Keep data private — share only the agent.',
  },
  {
    icon: '⚡',
    title: 'Fine-tune on your data',
    desc: 'Train models on your own datasets. Cut LLM usage costs by up to 90% at scale.',
    highlight90: true,
  },
]

const tiers = [
  { name: 'Free', desc: 'Self-hosted, community use, open source' },
  { name: 'Basic', desc: 'Hosted, token proxy, personal agents' },
  { name: 'Pro', desc: 'Marketplace publishing, integrations, priority support', featured: true, tag: 'Revenue share' },
  { name: 'Self-Hosted', desc: 'Full control, own infra, bring your LLM' },
  { name: 'Enterprise', desc: 'On-premises, GDPR / HIPAA, B2B licensing', tag: 'AI Act ready' },
]

export default function Slide6Scalability() {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg, padding: '44px 64px 48px' }}
    >
      {/* TOP */}
      <div className="mb-8 flex flex-col items-center">
        <div
          className="mb-3 text-lg font-bold uppercase tracking-[0.16em]"
          style={{ color: colors.brand }}
        >
          Scalability & Business Model
        </div>
        <h1
          className="text-center text-6xl font-extrabold leading-[1.15]"
          style={{ color: colors.text, letterSpacing: '-0.025em' }}
        >
          Open source core.{' '}
          <em className="not-italic" style={{ color: colors.brand }}>
            Enterprise ready.
          </em>
        </h1>
      </div>

      {/* BODY */}
      <div className="mb-7 grid w-full grid-cols-[1fr_1px_1fr] gap-x-9">
        {/* LEFT — Platform points */}
        <div className="flex flex-col justify-center gap-5">
          {points.map((p) => (
            <div key={p.title} className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[9px] border text-xl"
                style={{ background: colors.bgCard, borderColor: colors.cardBorder }}
              >
                {p.icon}
              </div>
              <div>
                <div className="mb-0.5 text-lg font-bold" style={{ color: colors.text }}>
                  {p.title}
                </div>
                <div className="text-base leading-[1.55]" style={{ color: '#888' }}>
                  {p.highlight90 ? (
                    <>
                      Train models on your own datasets. Cut LLM usage costs by up to{' '}
                      <strong style={{ color: colors.text }}>90%</strong> at scale.
                    </>
                  ) : (
                    p.desc
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DIVIDER */}
        <div style={{ background: '#EFEFEC' }} />

        {/* RIGHT — Pricing tiers */}
        <div className="flex flex-col justify-center gap-2">
          <div
            className="mb-2 text-sm font-bold uppercase tracking-[0.12em]"
            style={{ color: colors.brand }}
          >
            Business Model
          </div>
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                background: tier.featured ? '#FFFDF7' : colors.bgCard,
                borderColor: tier.featured ? 'rgba(245,166,35,0.3)' : colors.cardBorder,
              }}
            >
              <div
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: tier.featured ? colors.brand : '#E0DFDB' }}
              />
              <div
                className="w-28 flex-shrink-0 text-base font-bold"
                style={{ color: colors.text }}
              >
                {tier.name}
              </div>
              <div className="flex-1 text-sm leading-snug" style={{ color: '#888' }}>
                {tier.desc}
              </div>
              {tier.tag && (
                <span
                  className="flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(245,166,35,0.1)', color: colors.brand }}
                >
                  {tier.tag}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM STRIP */}
      <div
        className="flex items-center gap-2.5 rounded-full px-8 py-3.5"
        style={{ background: colors.bgDark }}
      >
        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: colors.brand }} />
        <div className="text-base font-medium tracking-wide text-white">
          Next:{' '}
          <em className="not-italic font-bold" style={{ color: colors.brand }}>
            Ship Matilda · Open-source lm
            <CozyThingText text="thing" className="text-base font-bold" /> · Launch enterprise pilot
          </em>
        </div>
        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: colors.brand }} />
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm"
        style={{ color: '#ccc' }}
      >
        Matilda &nbsp;&middot;&nbsp; powered by lm
        <CozyThingText text="thing" className="text-sm" />
      </div>
    </div>
  )
}
