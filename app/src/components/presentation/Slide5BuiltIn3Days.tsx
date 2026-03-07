import { colors } from './constants'

const columns = [
  {
    label: 'What We Built',
    items: [
      'Complete AI assistant for Greek high school teachers and students.',
      'Teacher Agent: generates lesson plans, exam guides, curriculum-aligned materials on demand.',
      'Student Agent: answers questions, explains concepts, quizzes on verified curriculum content.',
    ],
  },
  {
    label: 'What Works Today',
    items: [
      'End-to-end knowledge pipeline live in lmthing Studio.',
      'Specialist agents grounded in verified Greek curriculum.',
      'Zero hallucination outside known material \u2014 every answer traces back to a source file.',
    ],
  },
  {
    label: "What's Next for Matilda",
    items: [
      'Full Panhellenic curriculum coverage (currently a subject subset).',
      'Student progress tracking across sessions.',
      'Teacher onboarding UI and multi-subject wizard.',
    ],
  },
]

export default function Slide5BuiltIn3Days() {
  return (
    <div
      className="flex h-full w-full flex-col justify-center px-16 py-12"
      style={{ background: colors.bg }}
    >
      <div className="mb-10">
        <h2 className="text-5xl font-bold" style={{ color: colors.text }}>
          Built in 3 Days
        </h2>
        <p className="mt-2 text-xl" style={{ color: colors.brand }}>
          Matilda &mdash; AI for Greek high school education
        </p>
      </div>

      <div className="grid max-w-6xl grid-cols-3 gap-6">
        {columns.map((col) => (
          <div
            key={col.label}
            className="rounded-xl border p-6"
            style={{
              background: colors.bgCard,
              borderColor: colors.cardBorder,
              borderTop: `3px solid ${colors.brand}`,
            }}
          >
            <div
              className="mb-4 text-sm font-bold tracking-wide"
              style={{ color: colors.brand }}
            >
              {col.label}
            </div>
            <div className="flex flex-col gap-3">
              {col.items.map((item, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
