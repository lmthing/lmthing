# THING: a NEW topic mid-conversation gets rows/pages but no specialist space

**Symptom** (07-life-admin run 19 step 11, reconfirmed run 22): user introduces a brand-new life
topic mid-conversation. THING lands the DB rows and the app page (14 pages, built:true) but never
creates a specialist SPACE for the topic — `spaceCount` stayed 8. Later topic questions have no
owning space to route to (no knowledge home, no answer action).

**Expected:** the same organize principle that split the initial bulk dump applies incrementally: a
distinct new topic with facts ⇒ its own specialist space (knowledge + answer action), not just rows.

**Attribution sketch:** THING's mid-conversation path routes new facts through write_fact →
db/automator, but nothing evaluates "does this topic deserve a NEW specialist?" — that judgment only
exists inside organize_material's initial split. Candidate fix (L2): a lightweight check in the
write path (or a dedicated tasklist node) that, when a fact's topic matches NO registered space,
proposes/creates the specialist via the architect — with dedup against existing same-topic spaces
(see the earlier duplicate-specialist finding).

**Where:** `sdk/org/libs/core/system-spaces/user-thing/**` (instruct routing + possibly a new
tasklist node); architect delegation for the space creation.

---

## L1-prose attempt (2026-07-20): improves but does NOT reliably fix — needs L3/structure

A reliable repro is now committed: **`sdk/org/scenarios/repros/new-topic-specialist/`** (seed
`household-vault` = 3 specialist spaces + a database; trigger introduces a distinct new subject with
concrete facts; oracle `spaces count >= 4` via the new `spaces count` assert verb). **RED 4/4 on HEAD.**

An L1 prose fix was tried: a paragraph in `user-thing/agents/thing/instruct.md`'s "LIVE-project path"
(path 4a) that, alongside the automator delegate, dedups against the in-context `projectAgentsBlock`,
applies `organize_material`'s existing generic `loadKnowledge('organizing','split')` test, and — for a
genuine new subject — builds one specialist via the documented `synthesize_and_run` architect
delegation (reused verbatim, no architect edit; anti-overfit-clean). It **improved the repro from RED
4/4 → RED 2/4 but did NOT reach GREEN** — THING's *top-level decision to evaluate "is this a new
subject?" at all* is itself stochastic (~50%), so prose that describes the check is skipped half the
time. **The L1 edit was reverted** (not committable at RED 2/4). The exact prose is preserved in the
campaign attempt ledger / handoff.

**Conclusion — needs a STRUCTURAL (L2/L3) fix, not more prose.** Because the unreliable step is
THING's own choice to run the evaluation, a prose instruction (or even a tasklist THING must choose to
call) is skippable. Reliable options: make the new-subject evaluation an UNAVOIDABLE step in the write
path (e.g. the automator/write path returns "no owning space for this subject" and a code path acts on
it), or a code hook that fires specialist-creation when incremental rows land under no registered
space. This is the same "prose can't reliably fix stochastic THING execution → needs code enforcement"
class as `resolve-flagged-figure-destructive-write.md`.

---

## L2-structural attempt (2026-07-21, live 07-life-admin run 26 reconfirmed the symptom): improves to RED 1/4 — residual is L3

The L2 fix landed (sdk/org `863df88`): a dedicated **`user-thing/tasklists/add_area`** tasklist — the
incremental sibling of `organize_material` — `01-assess` (always runs; names the topic, decides
`isNewArea` via `loadKnowledge('organizing','split')` against `registeredSpaces` + `db.tables()`) →
`02-add_specialist` (`condition: assess.isNewArea == true` → `system-architect#synthesize_and_run`) →
`03-build_app` (automator) → `04-report`. The instruct LIVE-project path now routes a
genuinely-new-area add through `tasklist('add_area', …)` rather than a bare automator delegate. Space
dedup is now deterministic (architect `matchExistingSpace`, same commit), so a created specialist is
idempotent for a repeated topic.

**Repro moved RED 4/4 → RED 1/4** (`scenarios/repros/new-topic-specialist/`; runs 1,3,4 GREEN, run 2
RED with `spaces.count=3`). Once THING enters `add_area`, the specialist is created reliably — but
THING's **top-level choice to enter `add_area` vs a bare automator delegate is still stochastic**, so
one run in four skips the whole route. This is exactly the L3 gap named above: a tasklist THING must
*choose* to call is skippable. **Remaining L3 (not yet done):** a host-level code hook that fires
specialist-creation when incremental rows land under no registered space — runtime/pod code, outside
the user-thing prompt lane. Do NOT delete this issue; the L2 is committed but the symptom can still
recur ~1/4 until the L3 hook lands.
