# PROGRESS — scenario-campaign · task `05-latam` · round 1

_Started 2026-07-13T19:45:55.803Z. The agent MUST update this file at every step._

## Steps

- **Orient.** `05-latam/` has a fully-authored `scenario.md` (13 Acts, 6 sections, feature checklist)
  + 6 fixtures, but **no `run.mjs`** (deleted campaign-wide). Round-1 job = implement the runner 1:1
  from the spec, not re-author the story.
- **Harness read.** `provision.mjs`, `lib/{pod,thing,report,gateway,paths}.mjs`, `_template/run.mjs`.
- **Grounded the never-tested capabilities** (space tasklists, degraded `TaskEnvelope`, cron
  `ctx.state`, the 2-part vs 3-part `loadKnowledge` split, `maxHistoryTurns` summarization,
  `yield_resolved{kind,value}`).
- **Provisioned** the disposable prod user: `latam-mrh4xr6i@lmthing.test` / `user-381387982222943882`.
- **Wrote `05-latam/run.mjs`** (13 Acts, 1:1 with the Acts table); committed (sdk/org `d057fab`).
- **Smoke test green** against prod. Act I started → session died mid-run (see below).

### Attempt 2 (this session) — resumed after the interrupt

- **Triaged the interrupt: a HARNESS bug, not a product bug.** The runner died with an uncaught
  `TypeError: fetch failed` (undici `ConnectTimeoutError`, 10s, to `lmthing.chat:443`). `pod.req`
  wrapped every retry around HTTP *statuses* (`{waking:true}`/504) but the bare `fetch()` throwing
  was never caught, and the runner's `resilient()` wrapper only retries 404/error-state → rethrow →
  whole multi-hour run orphaned. **Fixed at the transport layer** (`fetchResilient` in
  `harness/lib/pod.mjs`, used by all 3 fetch sites + `gateway.mjs`'s `req`): a transient transport
  fault (connect timeout / ECONNRESET / socket hang up / EAI_AGAIN) is now retried like a `waking`
  answer; a non-transient error still throws at once, and a real HTTP 500 still passes through
  un-retried. **The harness had ZERO test coverage** (`scenarios/` was not in `vitest.config.ts`'s
  include list) → added the include + `lib/pod.test.mjs` (8 tests, green). Committed sdk/org
  `c924339`. This bug affects ALL SIX scenarios.
- **Discarded the contaminated Act I.** The resumed run reused the interrupted attempt's `sessionId`,
  whose server-side session had kept authoring after the client died (architect `fork:write_agent`
  events streamed in before Act I even began, and it had built a full app). Deleted the session +
  the `latam` project and re-ran Act I clean — a resumed-mid-authoring session cannot honestly test
  "did THING offer?".
- **PRODUCT BUG FOUND (US-1, the scenario's core promise): THING never OFFERED.** On the deployed
  image, the opener (notes attached + "help me get on top of this") produced a beautiful structured
  summary and **nothing else**: in the 13,079 chars Elena actually sees, ZERO occurrences of
  "want me to / shall I / should I / would you like / I can build / turn this into", zero mentions of
  "open / dashboard / one place", and the only 3 `?` were quotes from her own notes. She then says
  "yes please" — yes to *what?* — and THING builds the whole app anyway, on a consent it never asked
  for.
- **Root cause = a PROMPT bug, already fixed in source by the concurrent 06-tanzania agent**
  (`11a9396`, "PROPOSE unasked…"), which added the "But OFFER — do not wait to be asked" block.
  It is **committed but NOT deployed** (the live image's instruct is 27,067b and contains no offer
  rule at all). **Live-verified their fix by hot-patching the pod** (`PUT /api/fs/write` →
  `system/spaces/user-thing/agents/thing/instruct.md`, then restart): the offer appears, with **0
  authoring yields** (restraint holds — offer first, build only on consent). ⇒ **that fix MUST ship.**
- **Measured the fix honestly instead of trusting one green.** Built `harness/probe-ab.mjs` (patch a
  variant → restart → N fresh projects → same opener → count offers). Results over **15 live
  openers**:

  | variant | offered | invented specifics | authored unasked |
  |---|---|---|---|
  | deployed image (no offer rule) | **0/1** | — | 0 |
  | A — HEAD (tanzania's fix) | **5/6** | 0/6 | 0/6 |
  | B — HEAD + my grounding rule | 6/6 | 0/6 | 0/6 |
  | C — HEAD + my anti-burial rule | 2/3 | 0/3 | 0/3 |

- **HONEST FINDING: the offer is NONDETERMINISTIC (~5/6), and every single miss has the same shape —
  a LONG reply.** Offers happen at 1.2k–3.4k visible chars; the misses were at **5,071c** (A-arm),
  **6,611c** (the real Act I re-run) and **4,715c** (C-arm). When THING writes a long exhaustive
  breakdown it spends the whole turn proving it read the material and stops exactly where the help
  begins. The correlation is perfect; **my prompt edits did not reliably fix it** (B and C are within
  noise of A), so I **reverted both** rather than ship an unevidenced change to a brain every
  scenario shares — and rather than claim an improvement I cannot demonstrate.
- **Fixed a false-passing assertion in my own runner.** The Act I offer check regexed the *raw JSX
  descriptor JSON* (`lastText`), which both misses real prose (it lives in `children`/`props.rows`)
  and matches structural keys nobody said. Added `flattenDescriptor()`/`visibleText()` (read what the
  user actually SEES) and made the check **stronger**, not looser: it must PROPOSE *and* it must ASK
  (a question she can answer with a bare "yes") — an offer she cannot say yes to is an announcement.

## Next

- Re-run Act I on the hot-patched pod, then Acts II→XIII; land the mandated system-space improvement
  where the evidence is deterministic (the architect's `instruct.md` never mentions
  `forEach`/`condition`/`optional`/`dependsOn` — the predicted Act IX/X failure).

## Files added to context

- `sdk/org/scenarios/05-latam/scenario.md` — the spec I implement 1:1 (13 Acts).
- `sdk/org/scenarios/05-latam/run.mjs` — the runner (mine, committed `d057fab`).
- `sdk/org/scenarios/harness/lib/pod.mjs` — the 3 unguarded `fetch()` sites that killed the run.
- `sdk/org/scenarios/harness/lib/gateway.mjs` — its raw `req()` (4th site).
- `sdk/org/vitest.config.ts` — proves `scenarios/` was in NO test include pattern.
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — THING's triage brain; the
  OFFER rule (`11a9396`, another agent's; their uncommitted WIP is also live in this shared tree —
  do NOT stage this file).
- `sdk/org/libs/cli/src/server/routes/{fs,spaces}.ts` — the REAL hot-patch route is
  `PUT /api/fs/write {path,content}` (not `/api/projects/.../spaces/.../files/<rel>`).
