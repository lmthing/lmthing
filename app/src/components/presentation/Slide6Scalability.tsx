import { colors } from './constants'

const tiers = [
  { name: 'Free', opacity: 0.2 },
  { name: 'Basic', opacity: 0.35 },
  { name: 'Pro', opacity: 0.5 },
  { name: 'Self-Hosted', opacity: 0.7 },
  { name: 'Enterprise', opacity: 1 },
]

export default function Slide6Scalability() {
  return (
    <div
      className="flex h-full w-full items-center px-16 py-12"
      style={{ background: colors.bgSection }}
    >
      {/* Left side */}
      <div className="flex w-[55%] flex-col gap-10 pr-12">
        <div>
          <div className="mb-3 text-xs font-bold tracking-widest" style={{ color: colors.brand }}>
            HOW IT SCALES
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              23M+ AI enthusiasts actively building agents (r/LocalLLaMA, r/ChatGPT).
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              Open source: community grows the ecosystem of Spaces and Specialists.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              Education is the proof-of-concept &mdash; replicable in healthcare, legal, consulting, enterprise.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              On-premises deployment ready for regulated industries: GDPR, HIPAA, finance.
            </p>
          </div>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold tracking-widest" style={{ color: colors.brand }}>
            NEXT 2 WEEKS
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              Ship Matilda publicly &mdash; validate product-market fit in Greek education.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              Open-source lmthing and start growing the community.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              Expand to full Panhellenic curriculum and launch regulated-sector pilot.
            </p>
          </div>
        </div>
      </div>

      {/* Right side — Business Model tiers */}
      <div className="flex w-[45%] flex-col items-center">
        <div className="mb-6 text-xs font-bold tracking-widest" style={{ color: colors.brand }}>
          BUSINESS MODEL
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-full border-2 px-6 py-3 text-center text-sm font-semibold"
              style={{
                background: tier.opacity === 1 ? colors.bgDark : colors.white,
                borderColor: tier.opacity === 1 ? colors.bgDark : colors.cardBorder,
                color: tier.opacity === 1 ? colors.white : colors.text,
                opacity: 0.4 + tier.opacity * 0.6,
              }}
            >
              {tier.name}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-1 text-center">
          <p className="text-xs" style={{ color: colors.muted }}>
            B2B licensing for regulated sectors
          </p>
          <p className="text-xs" style={{ color: colors.muted }}>
            Marketplace: community-published Spaces and Specialists
          </p>
        </div>
      </div>
    </div>
  )
}
