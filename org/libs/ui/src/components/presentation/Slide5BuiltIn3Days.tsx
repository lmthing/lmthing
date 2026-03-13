import { colors } from './constants'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

const cards = [
  {
    icon: '⚡',
    stat: '< 1hr',
    title: 'Matilda, live',
    highlight: true,
    body: (
      <>
        Dimitris uploaded past Panhellenic exam material.{' '}
        <strong><CozyThingText text="THING" className="text-base font-semibold" /> structured his knowledge.</strong> His custom agent now produces verified
        material on demand.
        <br />
        <br />
        What used to take a <strong>full day of trial-and-error prompting</strong> — done in under
        an hour, with guaranteed accuracy.
      </>
    ),
  },
  {
    icon: '🎯',
    stat: '5',
    title: 'Mentors validated',
    body: (
      <>
        Pitched and stress-tested the idea with <strong>5 domain experts and mentors</strong> during
        the hackathon.
        <br />
        <br />
        Real feedback. Real signal. The problem resonated across{' '}
        <strong>education, legal, and consulting</strong> verticals.
      </>
    ),
  },
  {
    icon: '🚀',
    stat: '1',
    title: 'Full pitch shipped',
    body: (
      <>
        Built the complete pitch deck — architecture, positioning, narrative — as a{' '}
        <strong>
          working proof of lm
          <CozyThingText text="thing" className="text-lg font-semibold" />
          's value.
        </strong>
        <br />
        <br />
        The platform that helped build this pitch <strong>is the platform we're pitching.</strong>
      </>
    ),
  },
]

export default function Slide5BuiltIn3Days() {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg, padding: '48px 72px 52px' }}
    >
      {/* TOP */}
      <div className="mb-10 flex flex-col items-center">
        <div
          className="mb-4 text-lg font-bold uppercase tracking-[0.16em]"
          style={{ color: colors.brand }}
        >
          What we achieved in 3 days
        </div>
        <h1
          className="text-center text-6xl font-extrabold leading-[1.15]"
          style={{ color: colors.text, letterSpacing: '-0.025em' }}
        >
          Built it. <em className="not-italic" style={{ color: colors.brand }}>Validated it.</em>{' '}
          Shipped it.
        </h1>
      </div>

      {/* CARDS */}
      <div className="mb-9 grid w-full grid-cols-3 gap-5">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative flex flex-col overflow-hidden rounded-2xl border p-7 pb-8"
            style={{
              background: card.highlight ? '#FFFDF7' : colors.bgCard,
              borderColor: card.highlight ? 'rgba(245,166,35,0.25)' : colors.cardBorder,
            }}
          >
            {/* accent top bar */}
            <div
              className="absolute left-0 right-0 top-0 h-[3px]"
              style={{
                background: card.highlight ? colors.brand : colors.cardBorder,
                borderRadius: '16px 16px 0 0',
              }}
            />

            <div className="mb-3 text-5xl">{card.icon}</div>

            <div
              className="mb-1 text-6xl font-extrabold leading-none"
              style={{
                color: card.highlight ? colors.brand : colors.text,
                letterSpacing: '-0.03em',
              }}
            >
              {card.stat}
            </div>

            <div className="mb-3 text-2xl font-bold" style={{ color: colors.text }}>
              {card.title}
            </div>

            <div
              className="mb-4 h-[1.5px] w-8"
              style={{
                background: card.highlight ? 'rgba(245,166,35,0.4)' : colors.cardBorder,
              }}
            />

            <div className="text-lg leading-[1.65]" style={{ color: '#777' }}>
              {card.body}
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM STRIP */}
      <div
        className="flex items-center gap-2.5 rounded-full px-8 py-3.5"
        style={{ background: colors.bgDark }}
      >
        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: colors.brand }} />
        <div className="text-base font-medium tracking-wide text-white">
          Three days.{' '}
          <em className="not-italic font-bold" style={{ color: colors.brand }}>
            One use case shipped.
          </em>{' '}
          Five experts convinced.
        </div>
        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: colors.brand }} />
      </div>
    </div>
  )
}
