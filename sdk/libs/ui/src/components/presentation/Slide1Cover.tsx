import { colors } from './constants'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export default function Slide1Cover() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg }}
    >
      {/* Hackathon badge */}
      <span
        className="mb-10 rounded-full border-2 px-5 py-1.5 text-sm font-semibold tracking-wide"
        style={{ borderColor: colors.brand, color: colors.brand }}
      >
        AI Hackathon
      </span>

      {/* Headline */}
      <h1 className="text-center text-6xl font-bold leading-tight tracking-tight sm:text-7xl" style={{ color: colors.text }}>
        Your Knowledge. Your AI.
        <br />
        Your Rules.
      </h1>

      {/* Subtitle */}
      <p className="mt-6 text-center text-xl" style={{ color: colors.textSecondary }}>
        A no-code platform to turn domain expertise into specialized AI agents
      </p>

      {/* Product tag */}
      <div className="mt-16 flex items-center gap-2 text-lg">
        <span className="font-bold" style={{ color: colors.brand }}>Matilda</span>
        <span style={{ color: colors.muted }}>powered by</span>
        <span className="text-lg font-bold">
          lm<CozyThingText text="thing" className="text-lg font-bold" />
        </span>
      </div>
    </div>
  )
}
