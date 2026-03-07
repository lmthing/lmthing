import { colors } from './constants'

const rows = [
  { feature: 'No-code for domain experts', lmthing: true, claude: false, openclaw: false },
  { feature: 'Transparent knowledge', lmthing: true, claude: false, openclaw: false },
  { feature: 'Model agnostic', lmthing: true, claude: false, openclaw: true },
  { feature: 'On-premises deploy', lmthing: true, claude: false, openclaw: true },
  { feature: 'Open source', lmthing: true, claude: false, openclaw: true },
]

function Check() {
  return <span style={{ color: colors.green, fontSize: 18 }}>&#10003;</span>
}
function Cross() {
  return <span style={{ color: colors.muted, fontSize: 18 }}>&#10005;</span>
}

export default function Slide3Solution() {
  return (
    <div
      className="flex h-full w-full items-center px-16 py-12"
      style={{ background: colors.bg }}
    >
      {/* Left 45% */}
      <div className="flex w-[45%] flex-col gap-10 pr-12">
        <div>
          <div className="mb-3 text-xs font-bold tracking-widest" style={{ color: colors.brand }}>
            WHAT WE BUILT
          </div>
          <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
            Two layers. A knowledge organizer that turns expertise into structured, verified, AI-ready documents &mdash; and an agent builder that puts specialized AI on top. No prompt engineering. No code.
          </p>
        </div>
        <div>
          <div className="mb-3 text-xs font-bold tracking-widest" style={{ color: colors.brand }}>
            CORE INNOVATION
          </div>
          <p className="text-base leading-relaxed" style={{ color: colors.textSecondary }}>
            Pure control over your Things. Knowledge in plain files you can read, edit, and verify. Agents run on any model. Data never leaves your infrastructure.
          </p>
        </div>
      </div>

      {/* Right 55% */}
      <div className="w-[55%]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left" style={{ color: colors.muted }} />
              <th
                className="rounded-t-lg p-3 text-center font-bold"
                style={{ background: `${colors.brand}15`, color: colors.brand }}
              >
                lmthing
              </th>
              <th className="p-3 text-center font-medium" style={{ color: colors.muted }}>
                Claude Cowork
              </th>
              <th className="p-3 text-center font-medium" style={{ color: colors.muted }}>
                OpenClaw
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.feature}
                style={{
                  borderTop: `1px solid ${colors.cardBorder}`,
                  background: i % 2 === 0 ? 'transparent' : colors.bgCard,
                }}
              >
                <td className="p-3 text-left" style={{ color: colors.text }}>
                  {row.feature}
                </td>
                <td className="p-3 text-center" style={{ background: `${colors.brand}08` }}>
                  {row.lmthing ? <Check /> : <Cross />}
                </td>
                <td className="p-3 text-center">
                  {row.claude ? <Check /> : <Cross />}
                </td>
                <td className="p-3 text-center">
                  {row.openclaw ? <Check /> : <Cross />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
