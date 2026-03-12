import { colors } from './constants'

const domains = [
  ['⚖️ Legal', '📚 Education', '🏥 Health'],
  ['💼 Consulting', '🏋️ Fitness', '💰 Finance'],
]

const chips = ['Structuring knowledge', 'Connecting it to the model']

function Arrow() {
  return (
    <svg width="72" height="32" viewBox="0 0 72 32" fill="none" className="shrink-0">
      <line x1="0" y1="16" x2="56" y2="16" stroke={colors.brand} strokeWidth="3" />
      <polyline points="50,8 62,16 50,24" stroke={colors.brand} strokeWidth="3" fill="none" />
    </svg>
  )
}

export default function Slide2Problem() {
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: colors.bgSection, padding: '3rem 4rem 3rem' }}
    >
      {/* Slide title — top-left */}
      {/* <h2 style={{ color: colors.text, fontSize: '4.5rem', fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
        The Problem
      </h2> */}

      {/* Three sections — each gets equal flex so they own 1/3 of remaining height */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '2rem' }}>
        {/* Top — The Opportunity */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.75rem' }}>
          <div
            className="font-bold uppercase"
            style={{ color: colors.brand, fontSize: '2rem', letterSpacing: '0.15em' }}
          >
            The Problem
          </div>

          {/* Flow diagram */}
          <div className="flex items-center" style={{ gap: '1.5rem' }}>
            <div
              className="rounded-full border"
              style={{
                background: colors.bgCard,
                borderColor: colors.cardBorder,
                color: colors.text,
                fontSize: '1.4rem',
                padding: '0.85rem 1.75rem',
              }}
            >
              Domain Expert
            </div>
            <Arrow />
            <div
              className="rounded-full border-2"
              style={{
                background: colors.bgCard,
                borderColor: colors.brand,
                color: colors.text,
                fontSize: '1.4rem',
                padding: '0.85rem 1.75rem',
              }}
            >
              🧱 Engineering Wall
            </div>
            <Arrow />
            <div
              className="rounded-full border"
              style={{
                background: colors.bgCard,
                borderColor: colors.cardBorder,
                color: colors.text,
                fontSize: '1.4rem',
                padding: '0.85rem 1.75rem',
              }}
            >
              ❌ Can't Build
            </div>
          </div>

          {/* Chips */}
          <div className="flex" style={{ gap: '1rem' }}>
            {chips.map((chip) => (
              <div
                key={chip}
                className="rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${colors.brand}15, ${colors.brand}25)`,
                  color: colors.brandDark,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  padding: '0.65rem 1.4rem',
                  borderLeft: `4px solid ${colors.brand}`,
                  letterSpacing: '0.02em',
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>


        {/* Center — Dividing Statement (hero line) */}
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 700, fontSize: '4rem', lineHeight: 1.15, color: colors.text }}
        >
          The knowledge exists. The tools don't.
        </div>

        {/* Bottom — The Wall */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
          <div
            className="font-bold uppercase"
            style={{ color: colors.brand, fontSize: '2rem', letterSpacing: '0.15em' }}
          >
            The Opportunity
          </div>
          <div className="flex flex-col items-center" style={{ gap: '1.1rem' }}>
            {domains.map((row, ri) => (
              <div
                key={ri}
                className="flex"
                style={{ gap: '1.1rem' }}
              >
                {row.map((label) => (
                  <div
                    key={label}
                    className="rounded-full border"
                    style={{
                      background: colors.bgCard,
                      borderColor: colors.cardBorder,
                      color: colors.text,
                      fontSize: '1.3rem',
                      fontWeight: 400,
                      padding: '0.6rem 1.5rem',
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
