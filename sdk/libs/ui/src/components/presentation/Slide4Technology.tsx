import { colors } from './constants'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

const flowNodes = [
  { label: 'You', sub: 'Domain expert' },
  { label: 'THING', sub: 'Organises \u00b7 Routes \u00b7 Controls', hero: true, isThing: true },
  { label: 'Structured Knowledge', sub: 'Fields \u00b7 Topics \u00b7 Verified files' },
  { label: 'Specialist Agent', sub: 'Grounded in your domain' },
  { label: 'Grounded Response', sub: 'No hallucinations' },
]

const techniques = ['RAG', 'Structured Prompt Engineering', 'Multi-Agent Orchestration']

function Arrow() {
  return (
    <div className="flex items-center px-5" style={{ height: 76 }}>
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
          className="text-center text-6xl font-extrabold leading-[1.3]"
          style={{ color: colors.text, letterSpacing: '-0.025em' }}
        >
          <CozyThingText text="THING" className="text-6xl font-extrabold leading-[1.3]" /> turns your knowledge into agents
          <br />
          that <em className="not-italic" style={{ color: colors.brand }}>actually know your domain.</em>
        </h1>
      </div>

      {/* MIDDLE: flow strip */}
      <div className="mb-16 flex w-full items-start justify-center">
        {flowNodes.map((node, i) => (
          <div key={node.label} className="flex items-start">
            <div className="flex flex-col items-center gap-2.5">
              <div
                className="flex items-center justify-center whitespace-nowrap rounded-2xl border-2 text-xl font-semibold"
                style={
                  node.hero
                    ? {
                        background: '#E8E8E8',
                        borderColor: '#D0D0D0',
                        color: '#fff',
                        fontSize: 26,
                        fontWeight: 800,
                        padding: '24px 40px',
                        borderRadius: 20,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        letterSpacing: '0.02em',
                        height: 76,
                      }
                    : {
                        background: colors.bgCard,
                        borderColor: colors.cardBorder,
                        color: colors.text,
                        padding: '0 32px',
                        height: 76,
                      }
                }
              >
                {node.isThing ? <CozyThingText text={node.label} className="font-extrabold text-4xl" /> : node.label}
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
    </div>
  )
}
