import { colors } from './constants'
import { CozyThingText } from '@/CozyText'
import screenshotUrl from '../../../../docs/presentation/localhost_3000_studio_local%2Fgreek-cooking.png'

const pills = ['No code', 'Any domain', 'Your knowledge', 'Any AI model']

export default function Slide3Solution() {
  return (
    <div
      className="relative flex h-full w-full items-center px-16 py-12"
      style={{ background: colors.bg }}
    >
      {/* Left column */}
      <div className="flex w-1/2 flex-col gap-6 pr-12">
        <div className="text-2xl font-bold tracking-widest" style={{ color: colors.brand }}>
          THE SOLUTION
        </div>

        <div className="text-4xl font-bold">
          lm<CozyThingText text="thing" className="text-4xl font-bold" />
        </div>

        <h2 className="text-6xl font-bold leading-tight" style={{ color: colors.text }}>
          The no-code studio for
          <br />
          <span style={{ color: colors.brand }}>domain experts.</span>
        </h2>

        <p className="text-2xl leading-relaxed" style={{ color: colors.textSecondary }}>
          lmthing lets Dimitris &mdash; and anyone like him &mdash; build a specialized AI agent
          with just their knowledge. No engineers required.
        </p>

        <div className="flex flex-wrap gap-4">
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full border-2 px-6 py-3 text-lg font-medium"
              style={{ borderColor: colors.brand, color: colors.brand }}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* Right column */}
      <div className="flex w-1/2 items-center justify-center">
        <div
          className="rounded-2xl border p-2"
          style={{
            background: colors.white,
            borderColor: colors.cardBorder,
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          <img src={screenshotUrl} alt="lmthing studio screenshot" className="w-full rounded-2xl" />
        </div>
      </div>

    </div>
  )
}
