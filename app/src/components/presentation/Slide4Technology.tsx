import { colors } from './constants'

const flowNodes = ['User', 'THING', 'Agent', 'Knowledge', 'Response']
const techniques = ['RAG', 'Structured Prompting', 'Multi-Agent Orchestration']

export default function Slide4Technology() {
  return (
    <div
      className="flex h-full w-full items-center px-12 py-10"
      style={{ background: colors.bg }}
    >
      {/* Left 55% — Architecture SVG inline */}
      <div className="flex w-[55%] items-center justify-center pr-8">
        <svg
          width="100%"
          viewBox="0 0 1200 700"
          xmlns="http://www.w3.org/2000/svg"
          fontFamily="Arial, Helvetica, sans-serif"
          style={{ maxHeight: '80vh' }}
        >
          <defs>
            <marker id="at" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#00C896" />
            </marker>
            <marker id="ag" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#666" />
            </marker>
          </defs>

          <rect width="1200" height="700" fill="#141414" />

          {/* USER BOX */}
          <rect x="460" y="18" width="280" height="64" rx="10" fill="#1A2E28" stroke="#00C896" strokeWidth="2" />
          <text x="600" y="46" textAnchor="middle" fill="#FFF" fontSize="18" fontWeight="bold">USER</text>
          <text x="600" y="68" textAnchor="middle" fill="#00C896" fontSize="13">Domain Expert</text>

          {/* Arrow: User -> THING */}
          <path d="M 510,82 C 430,125 300,152 200,176" stroke="#00C896" strokeWidth="2" fill="none" markerEnd="url(#at)" />
          <rect x="330" y="100" width="90" height="21" rx="4" fill="#141414" />
          <text x="375" y="115" textAnchor="middle" fill="#00C896" fontSize="12" fontStyle="italic">via THING</text>

          {/* Arrow: User -> Agent Direct */}
          <path d="M 680,82 C 680,140 560,168 560,206" stroke="#666" strokeWidth="2" fill="none" strokeDasharray="6,4" markerEnd="url(#ag)" />
          <rect x="696" y="110" width="54" height="21" rx="4" fill="#141414" />
          <text x="723" y="125" textAnchor="middle" fill="#777" fontSize="12" fontStyle="italic">direct</text>

          {/* THING BOX */}
          <rect x="28" y="178" width="340" height="200" rx="14" fill="#0D1F1A" stroke="#00C896" strokeWidth="2.5" />
          <rect x="28" y="178" width="340" height="48" rx="14" fill="#00C896" />
          <rect x="28" y="200" width="340" height="26" fill="#00C896" />
          <text x="198" y="213" textAnchor="middle" fill="#0D1F1A" fontSize="22" fontWeight="bold" letterSpacing="3">THING</text>
          <text x="198" y="252" textAnchor="middle" fill="#EEE" fontSize="15" fontWeight="bold">System Agent</text>
          <text x="198" y="274" textAnchor="middle" fill="#999" fontSize="12">Orchestrates across all Spaces</text>
          <rect x="62" y="288" width="252" height="30" rx="8" fill="#142018" stroke="#00C896" strokeWidth="1" strokeOpacity="0.5" />
          <text x="188" y="308" textAnchor="middle" fill="#00C896" fontSize="12">Own LLM config (any provider)</text>
          <rect x="62" y="326" width="252" height="30" rx="8" fill="#1A2E26" stroke="#00C896" strokeWidth="1" strokeOpacity="0.35" />
          <text x="188" y="346" textAnchor="middle" fill="#00C896" fontSize="12" fontWeight="bold">Full access to all Spaces</text>

          {/* Also controls */}
          <text x="198" y="405" textAnchor="middle" fill="#666" fontSize="11">Also controls:</text>
          <rect x="62" y="414" width="110" height="28" rx="6" fill="#131F1A" stroke="#00C896" strokeWidth="1" strokeOpacity="0.35" />
          <text x="117" y="432" textAnchor="middle" fill="#555" fontSize="12">Space B</text>
          <rect x="186" y="414" width="110" height="28" rx="6" fill="#131F1A" stroke="#00C896" strokeWidth="1" strokeOpacity="0.35" />
          <text x="241" y="432" textAnchor="middle" fill="#555" fontSize="12">Space C</text>

          {/* Arrow: THING -> Space */}
          <path d="M 368,288 L 408,288" stroke="#00C896" strokeWidth="2" markerEnd="url(#at)" />
          <text x="388" y="281" textAnchor="middle" fill="#00C896" fontSize="11">controls</text>

          {/* SPACE CONTAINER */}
          <rect x="408" y="162" width="764" height="516" rx="16" fill="#161616" stroke="#00C896" strokeWidth="2" />
          <text x="432" y="193" fill="#00C896" fontSize="15" fontWeight="bold">SPACE</text>
          <line x1="484" y1="175" x2="484" y2="200" stroke="#00C896" strokeWidth="1" strokeOpacity="0.3" />
          <text x="496" y="193" fill="#555" fontSize="13">Knowledge &middot; Agents &middot; Workflows &middot; Settings</text>

          {/* AGENT BOX */}
          <rect x="428" y="208" width="264" height="140" rx="10" fill="#1A2E26" stroke="#00C896" strokeWidth="1.5" />
          <text x="560" y="235" textAnchor="middle" fill="#00C896" fontSize="15" fontWeight="bold">Agent</text>
          <text x="560" y="257" textAnchor="middle" fill="#CCC" fontSize="12">Specialized Prompt + Tools</text>
          <rect x="462" y="268" width="196" height="28" rx="6" fill="#0E1A16" stroke="#00C896" strokeWidth="1" strokeOpacity="0.4" />
          <text x="560" y="287" textAnchor="middle" fill="#00C896" fontSize="12">Own LLM config</text>
          <text x="560" y="334" textAnchor="middle" fill="#555" fontSize="11" fontStyle="italic">1...N agents per Space</text>

          {/* Arrow: Agent -> Knowledge */}
          <path d="M 692,262 L 718,262" stroke="#00C896" strokeWidth="1.5" fill="none" strokeDasharray="4,3" markerEnd="url(#at)" />
          <text x="705" y="255" textAnchor="middle" fill="#666" fontSize="10">reads</text>

          {/* Arrow: Agent -> Workflows */}
          <path d="M 560,348 L 560,368" stroke="#00C896" strokeWidth="1.5" fill="none" strokeDasharray="4,3" markerEnd="url(#at)" />
          <text x="600" y="363" fill="#666" fontSize="10">triggers</text>

          {/* WORKFLOWS BOX */}
          <rect x="428" y="370" width="264" height="84" rx="10" fill="#1A1A1A" stroke="#00C896" strokeWidth="1" strokeOpacity="0.6" />
          <text x="560" y="400" textAnchor="middle" fill="#FFF" fontSize="14" fontWeight="bold">Workflows</text>
          <text x="560" y="420" textAnchor="middle" fill="#999" fontSize="12">Chained steps &middot; Autonomous</text>
          <text x="560" y="440" textAnchor="middle" fill="#555" fontSize="11">User or Agent triggered</text>

          {/* SETTINGS BOX */}
          <rect x="428" y="468" width="264" height="68" rx="10" fill="#161616" stroke="#444" strokeWidth="1" />
          <text x="560" y="498" textAnchor="middle" fill="#666" fontSize="13" fontWeight="bold">Settings</text>
          <text x="560" y="520" textAnchor="middle" fill="#444" fontSize="11">Config &middot; Permissions &middot; LLM defaults</text>

          {/* KNOWLEDGE AREA */}
          <rect x="718" y="200" width="434" height="452" rx="10" fill="#121A18" stroke="#00C896" strokeWidth="1" strokeOpacity="0.4" />
          <text x="935" y="228" textAnchor="middle" fill="#00C896" fontSize="14" fontWeight="bold">Knowledge</text>

          {/* Field 1 */}
          <rect x="738" y="242" width="186" height="34" rx="8" fill="#1F2F2A" stroke="#00C896" strokeWidth="1" />
          <text x="831" y="264" textAnchor="middle" fill="#FFF" fontSize="13" fontWeight="bold">Field</text>
          <line x1="831" y1="276" x2="831" y2="296" stroke="#00C896" strokeWidth="1" strokeOpacity="0.5" />
          <rect x="754" y="296" width="154" height="28" rx="6" fill="#172120" stroke="#00C896" strokeWidth="1" strokeOpacity="0.5" />
          <text x="831" y="315" textAnchor="middle" fill="#CCC" fontSize="12">Topic</text>
          <line x1="831" y1="324" x2="831" y2="340" stroke="#00C896" strokeWidth="1" strokeOpacity="0.35" />
          <rect x="764" y="340" width="134" height="24" rx="5" fill="#111816" stroke="#444" strokeWidth="1" />
          <text x="831" y="357" textAnchor="middle" fill="#666" fontSize="11">.md files</text>
          <line x1="831" y1="364" x2="831" y2="380" stroke="#00C896" strokeWidth="1" strokeOpacity="0.3" />
          <rect x="754" y="380" width="154" height="28" rx="6" fill="#172120" stroke="#00C896" strokeWidth="1" strokeOpacity="0.5" />
          <text x="831" y="399" textAnchor="middle" fill="#CCC" fontSize="12">Topic</text>
          <line x1="831" y1="408" x2="831" y2="424" stroke="#00C896" strokeWidth="1" strokeOpacity="0.35" />
          <rect x="764" y="424" width="134" height="24" rx="5" fill="#111816" stroke="#444" strokeWidth="1" />
          <text x="831" y="441" textAnchor="middle" fill="#666" fontSize="11">.md files</text>

          {/* Field 2 */}
          <rect x="946" y="242" width="186" height="34" rx="8" fill="#1F2F2A" stroke="#00C896" strokeWidth="1" />
          <text x="1039" y="264" textAnchor="middle" fill="#FFF" fontSize="13" fontWeight="bold">Field</text>
          <line x1="1039" y1="276" x2="1039" y2="296" stroke="#00C896" strokeWidth="1" strokeOpacity="0.5" />
          <rect x="962" y="296" width="154" height="28" rx="6" fill="#172120" stroke="#00C896" strokeWidth="1" strokeOpacity="0.5" />
          <text x="1039" y="315" textAnchor="middle" fill="#CCC" fontSize="12">Topic</text>
          <line x1="1039" y1="324" x2="1039" y2="340" stroke="#00C896" strokeWidth="1" strokeOpacity="0.35" />
          <rect x="972" y="340" width="134" height="24" rx="5" fill="#111816" stroke="#444" strokeWidth="1" />
          <text x="1039" y="357" textAnchor="middle" fill="#666" fontSize="11">.md files</text>

          {/* More fields */}
          <text x="935" y="460" textAnchor="middle" fill="#444" fontSize="12" fontStyle="italic">... more fields</text>

          {/* Verified strip */}
          <rect x="738" y="474" width="394" height="58" rx="8" fill="#0D1A14" />
          <text x="935" y="498" textAnchor="middle" fill="#00C896" fontSize="12" fontWeight="bold">Transparent &middot; Editable &middot; Auditable</text>
          <text x="935" y="518" textAnchor="middle" fill="#666" fontSize="11">Plain markdown - grounding source for all agents, readable by humans</text>

          {/* Bottom note */}
          <text x="600" y="692" textAnchor="middle" fill="#444" fontSize="11">
            Each agent (including THING) carries its own LLM config - swap OpenAI, Anthropic, or Google without rebuilding anything.
          </text>
        </svg>
      </div>

      {/* Right 45% */}
      <div className="flex w-[45%] flex-col gap-10 pl-4">
        {/* Data Flow */}
        <div>
          <div className="mb-4 text-xs font-bold tracking-widest" style={{ color: colors.teal }}>
            DATA FLOW
          </div>
          <div className="flex items-center gap-2">
            {flowNodes.map((node, i) => (
              <div key={node} className="flex items-center gap-2">
                <span
                  className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium"
                  style={{ background: colors.card, color: colors.white, border: `1px solid rgba(255,255,255,0.1)` }}
                >
                  {node}
                </span>
                {i < flowNodes.length - 1 && (
                  <svg width="20" height="12" viewBox="0 0 20 12">
                    <path d="M0,6 L16,6" stroke={colors.teal} strokeWidth="2" />
                    <path d="M13,2 L18,6 L13,10" stroke={colors.teal} strokeWidth="2" fill="none" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Techniques */}
        <div>
          <div className="mb-4 text-xs font-bold tracking-widest" style={{ color: colors.teal }}>
            TECHNIQUES
          </div>
          <div className="flex flex-wrap gap-3">
            {techniques.map((t) => (
              <span
                key={t}
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={{ borderColor: colors.teal, color: colors.teal }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
