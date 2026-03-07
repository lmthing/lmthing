import { colors } from './constants'

const problems = [
  {
    label: 'THE REAL PROBLEM',
    text: "Domain experts can't encode their knowledge into AI without engineers. The result: hallucinations, generic answers, AI that doesn't know your field.",
  },
  {
    label: "WHO'S AFFECTED",
    text: 'Educators, consultants, lawyers, product teams \u2014 anyone with deep domain expertise who wants AI that actually knows their stuff.',
  },
  {
    label: 'WHY NOW',
    text: 'AI adoption is exploding but reliability is collapsing. Early enthusiasm is hitting the wall of "it doesn\'t know our business."',
  },
  {
    label: 'WHAT CHANGES',
    text: 'Domain experts become AI builders. Your knowledge works 24/7, answers consistently, never hallucinates outside your verified facts.',
  },
]

export default function Slide2Problem() {
  return (
    <div
      className="flex h-full w-full flex-col justify-center px-16 py-12"
      style={{ background: colors.bgSection }}
    >
      <h2 className="mb-12 text-5xl font-bold" style={{ color: colors.text }}>
        The Problem
      </h2>

      <div className="grid max-w-6xl grid-cols-2 gap-6">
        {problems.map((p) => (
          <div
            key={p.label}
            className="rounded-xl border p-6"
            style={{ background: colors.white, borderColor: colors.cardBorder }}
          >
            <div
              className="mb-3 text-xs font-bold tracking-widest"
              style={{ color: colors.brand }}
            >
              {p.label}
            </div>
            <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
              {p.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
