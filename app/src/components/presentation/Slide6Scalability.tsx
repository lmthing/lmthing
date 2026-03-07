import { colors } from './constants'

const tiers = [
  { name: 'Free', opacity: 0.3 },
  { name: 'Basic', opacity: 0.45 },
  { name: 'Pro', opacity: 0.6 },
  { name: 'Self-Hosted', opacity: 0.8 },
  { name: 'Enterprise', opacity: 1 },
]

export default function Slide6Scalability() {
  return (
    <div
      className="flex h-full w-full items-center px-16 py-12"
      style={{ background: colors.bg }}
    >
      {/* Left side */}
      <div className="flex w-[55%] flex-col gap-10 pr-12">
        <div>
          <div className="mb-3 text-xs font-bold tracking-widest" style={{ color: colors.teal }}>
            HOW IT SCALES
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              23M+ AI enthusiasts actively building agents (r/LocalLLaMA, r/ChatGPT).
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              Open source: community grows the ecosystem of Spaces and Specialists.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              Education is the proof-of-concept &mdash; replicable in healthcare, legal, consulting, enterprise.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              On-premises deployment ready for regulated industries: GDPR, HIPAA, finance.
            </p>
          </div>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold tracking-widest" style={{ color: colors.teal }}>
            NEXT 2 WEEKS
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              Ship Matilda publicly &mdash; validate product-market fit in Greek education.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              Open-source lmthing and start growing the community.
            </p>
            <p className="text-base leading-relaxed" style={{ color: colors.white }}>
              Expand to full Panhellenic curriculum and launch regulated-sector pilot.
            </p>
          </div>
        </div>
      </div>

      {/* Right side — Business Model tiers */}
      <div className="flex w-[45%] flex-col items-center">
        <div className="mb-6 text-xs font-bold tracking-widest" style={{ color: colors.teal }}>
          BUSINESS MODEL
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-full px-6 py-3 text-center text-sm font-semibold"
              style={{
                background: `rgba(0, 200, 150, ${tier.opacity * 0.25})`,
                border: `1.5px solid rgba(0, 200, 150, ${tier.opacity})`,
                color: `rgba(0, 200, 150, ${0.5 + tier.opacity * 0.5})`,
              }}
            >
              {tier.name}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-1 text-center">
          <p className="text-xs" style={{ color: colors.dimmed }}>
            B2B licensing for regulated sectors
          </p>
          <p className="text-xs" style={{ color: colors.dimmed }}>
            Marketplace: community-published Spaces and Specialists
          </p>
        </div>
      </div>
    </div>
  )
}
