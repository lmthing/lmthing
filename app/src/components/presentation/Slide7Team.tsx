import { User } from 'lucide-react'
import { colors } from './constants'

const members = [
  { name: 'Member 1', role: 'Role / Expertise' },
  { name: 'Member 2', role: 'Role / Expertise' },
  { name: 'Member 3', role: 'Role / Expertise' },
  { name: 'Member 4', role: 'Role / Expertise' },
  { name: 'Member 5', role: 'Role / Expertise' },
]

export default function Slide7Team() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ background: colors.bg }}
    >
      <h2 className="mb-16 text-5xl font-bold" style={{ color: colors.white }}>
        Team Behind the Build
      </h2>

      <div className="flex gap-12">
        {members.map((m) => (
          <div key={m.name} className="flex flex-col items-center">
            <div
              className="flex size-24 items-center justify-center rounded-full"
              style={{
                background: colors.card,
                border: `2px solid ${colors.teal}`,
              }}
            >
              <User size={36} style={{ color: colors.teal }} />
            </div>
            <p className="mt-4 text-sm font-bold" style={{ color: colors.white }}>
              {m.name}
            </p>
            <p className="mt-1 text-xs" style={{ color: colors.muted }}>
              {m.role}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
