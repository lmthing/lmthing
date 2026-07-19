# THING recompiles stale data into a fake answer instead of routing a research-needing ask to research

**Symptom** (06-tanzania run 32 step 7, 2026-07-20): the user asks a multi-topic (4-topic)
parallel-research question whose answer is NOT in the project's own data. THING never calls
`delegate()` or `tasklist('research_and_store', …)` — ZERO delegates the whole turn — and instead
recompiles pre-existing DB cost figures into a confident-sounding but fabricated answer. No knowledge
file is written (confirmed via disk mtimes: nothing created during the step).

**Distinct from the step-5 auto-capture bug** (delegate.ts/turn-loop.ts): that bug requires a
`delegate()` to have HAPPENED before the auto-capture kills the escalation. Step 7 has zero delegates
— the failure is upstream, in THING's OWN top-level routing/triage: it does not recognize that the
ask needs world-fact research and never enters a research path at all.

**This is cause (c) of research-store-noop-diagnosis** — the persistence problem is multi-causal;
(a) auto-capture early-stop and (b) the fork pool-leak are framework fixes (in progress), but (c) is
a THING-instruct routing gap that the framework fixes do NOT address. The repro's runs 2&3 showed a
sibling of this (THING delegating research to `system-research/researcher` directly instead of the
specialist's own `research_and_store`); step 7 is the more severe form (no research at all).

**Attribution:** `libs/core/system-spaces/user-thing/agents/thing/instruct.md` — the read-routing
section. Two competing triage paths were noted earlier (§"Answering a question" says "delegate to the
matching space agent … let its research path handle it"; §"Research the web" gives a generic
`delegate('system-research','researcher','research',…)` example), and for a multi-topic ask the model
sometimes takes neither — it answers inline from existing data.

**Fix direction (L1/L2, user-thing — no domain literals):** THING's read-routing must reliably detect
"this ask needs world-fact research not present in my data/knowledge" and route it into a research
path (the owning specialist's `research_and_store`, or `system-research` when no specialist owns the
topic), for EACH sub-topic of a multi-topic ask — never recompile existing rows into a fresh factual
claim. Dedup/clarify the two competing triage paths so the branch is unambiguous. Pairs with the
framework fixes (a)+(b): only once THING routes to research do those fixes let the finding persist.

**Verify:** 06 step 7 class re-run — a multi-topic research ask produces webSearch/webFetch yields and
lands sourced knowledge files (one per topic), not an inline recompilation. Coordinate with any active
user-thing lane (this file overlaps the THING-brain subsystem).

**Evidence:** scenarios/06-tanzania/runs/32/step-07.json (zero delegate yields; no knowledge written);
scenarios/06-tanzania/runs/32/snapshots/step-06/ (pre-bug snapshot). Judged 2026-07-20.
