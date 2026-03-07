import { colors } from './constants'

const flowNodes = [
  { label: 'You', sub: 'Domain expert' },
  { label: 'THING', sub: 'Organises \u00b7 Routes \u00b7 Controls', hero: true },
  { label: 'Structured Knowledge', sub: 'Fields \u00b7 Topics \u00b7 Verified files' },
  { label: 'Specialist Agent', sub: 'Grounded in your domain' },
  { label: 'Grounded Response', sub: 'No hallucinations' },
]

const techniques = ['RAG', 'Structured Prompt Engineering', 'Multi-Agent Orchestration']

function Arrow() {
  return (
    <div className="flex items-center px-5" style={{ paddingBottom: 28 }}>
      <svg
        width="38"
        height="38"
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.brand}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.7 }}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </div>
  )
}

export default function Slide4Technology() {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg, padding: '60px 80px 56px' }}
    >
      {/* TOP: headline */}
      <div className="mb-16 flex flex-col items-center">
        <div
          className="mb-5 text-xl font-bold uppercase tracking-[0.16em]"
          style={{ color: colors.brand }}
        >
          How it works
        </div>
        <h1
          className="text-center text-6xl font-extrabold leading-[1.15]"
          style={{ color: colors.text, letterSpacing: '-0.025em' }}
        >
          THING turns your knowledge into agents
          <br />
          that <em className="not-italic" style={{ color: colors.brand }}>actually know your domain.</em>
        </h1>
      </div>

      {/* MIDDLE: flow strip */}
      <div className="mb-16 flex w-full items-center justify-center">
        {flowNodes.map((node, i) => (
          <div key={node.label} className="flex items-center">
            <div className="flex flex-col items-center gap-2.5">
              <div
                className="whitespace-nowrap rounded-2xl border-2 px-8 py-5 text-xl font-semibold"
                style={
                  node.hero
                    ? {
                        background: colors.brand,
                        borderColor: colors.brand,
                        color: '#fff',
                        fontSize: 26,
                        fontWeight: 800,
                        padding: '24px 40px',
                        borderRadius: 20,
                        boxShadow: '0 12px 40px rgba(245,166,35,0.35)',
                        letterSpacing: '0.02em',
                      }
                    : {
                        background: colors.bgCard,
                        borderColor: colors.cardBorder,
                        color: colors.text,
                      }
                }
              >
                {node.label}
              </div>
              <div
                className="max-w-[160px] text-center text-base leading-snug"
                style={
                  node.hero
                    ? {
                        color: colors.brand,
                        fontWeight: 600,
                        fontSize: 15,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase' as const,
                      }
                    : { color: colors.muted }
                }
              >
                {node.sub}
              </div>
            </div>
            {i < flowNodes.length - 1 && <Arrow />}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mb-9 h-px w-full" style={{ background: '#F0EFEC' }} />

      {/* BOTTOM: technique badges */}
      <div className="flex items-center gap-5">
        {techniques.map((t) => (
          <span
            key={t}
            className="rounded-full border-2 bg-white px-7 py-3.5 text-lg font-semibold"
            style={{ borderColor: colors.brand, color: colors.text }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm"
        style={{ color: '#ccc' }}
      >
        Matilda &nbsp;&middot;&nbsp; powered by lmthing
      </div>
      <div
        className="absolute bottom-5 right-6 text-sm"
        style={{ color: '#ccc' }}
      >
        4 / 7
      </div>
    </div>
  )
}
