# specialist research bypasses research_and_store → findings never stored (DIAGNOSED)

**Symptom** (06 run 26 step 5; same class 07 step 5): the specialist's research ran (sourced answer
delivered) but NO knowledge file was written — the next question re-researches.

**DIAGNOSIS (2026-07-19, from run 26 step-05.full.json yield chain):** the specialist ran its
`answer` tasklist (covered:false), then called **`webSearch`/`webFetch` DIRECTLY at its top level**
— never entering `research_and_store` (no tasklist yield for it), so the store node never existed
on the executed path. The prompt says "use research_and_store"; the DTS offered the direct
functions; affordance beat prose. Two enabling facts:

1. `webSearch`/`webFetch` are **system-global universal functions** (`system.ts#GLOBAL_SPACE_NAME`
   toolkit) — injected into every agent context including scaffolded specialists.
2. Their TS bodies execute **in the VM on ambient `fetch`** (`bootstrap.ts:206` injects fetch
   unconditionally; `library-dts.ts:99` declares it unconditionally) — which also means the model
   can hand-roll raw HTTP itself, and the Tavily API key (env-interpolated into the body/args)
   **leaks into step evidence** (seen verbatim in run 26's fetch yield args — separate hygiene
   item: evidence should redact known secret patterns).

**FIX DESIGN (two slices, both the not-granted ⇒ not-injected ⇒ absent-from-DTS pattern):**

- **Slice A — fetch off the model surface** (the readFileRaw treatment): KEEP injecting `fetch`
  (system-function bodies need it at runtime; they are not typechecked against the model DTS) but
  REMOVE its declaration from the model-facing ambient DTS (`buildAmbientDts` path), retaining it
  in the full `LIBRARY_DTS` used by `typecheckSource` for internal bodies. Model-authored
  `fetch(...)` then fails typecheck (clean retryable) in every agent/fork/delegate context. Survey
  2026-07-19: zero legitimate model-surface fetch users (system-space prompts contain only
  ✗-examples; store-catalog usage is app/server code outside the VM).

- **Slice B — research functions become granted, not universal** (design VALIDATED against the
  real resolution semantics 2026-07-19; NOT yet implemented): remove `webSearch`/`webFetch` from
  the universal toolkit for the TOP-LEVEL VM (prompt block, overlay/DTS, injection) unless the
  agent's `functions:` frontmatter names them (grant to user-thing THING + system-research
  researcher; both currently have `functions: []` and rely on universality).
  **CRITICAL CONSTRAINT discovered:** fork task nodes resolve `functions:` by NARROWING from the
  parent session's injected pool (`fork.ts:302-307` — an allow-list, never an add), so naive
  filtering would break `research_and_store`'s research node (functions: [webSearch, webFetch])
  for exactly the specialists being redirected to it. Implementation therefore needs a TWO-SET
  split: `injectedFunctions` (filtered — what the top-level VM sees/typechecks) vs the FORK-ENGINE
  POOL (unfiltered superset — what task allow-lists select from). Thread the pool separately in
  session.ts (buildInjectedFunctions + the 3 system-block sites, all have `agent` in scope) and
  delegate.ts (~155). Helper: `GRANTED_ONLY_SYSTEM_FUNCTIONS = {webSearch, webFetch}` +
  `filterUniversalFunctions(map, agent.functions)` in spaces/system.ts. Tests:
  system-functions.test.ts universality pins evolve; new lockstep test (specialist top level lacks
  webSearch declaration + injection; THING/researcher have it; research NODE still resolves it).
  Docs: runtime-globals README table + system-spaces page.

**Verify:** (1) unit: model code calling fetch/webSearch fails typecheck in a scaffolded-specialist
context, passes in THING/research contexts; webSearch still executes end-to-end where granted.
(2) behavioral: 06 step 5 / 07 step 5 class — research fires AND a sourced knowledge file lands;
follow-up question answers from the store with zero research yields.

**Also fixed already (2026-07-19):** 04-write_agent.md — the scaffolded agent prompt now CHECKS
`s.data.stored` (retry once, honest save-failed note) instead of ignoring it. In tree, uncommitted.
