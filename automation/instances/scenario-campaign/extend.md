# EXTEND an existing lmthing scenario — `{{SCENARIO_ID}}`

You are GROWING `{{SCENARIO_DIR}}/scenario.yaml` with additional steps, in-persona. You author the
extension and stop — you do NOT run it and you do NOT touch product code. The judge runs it next; a
human reviews and commits. (This is the same guidance the judge follows when a fully-green scenario
needs to grow.)

{{include:scenario-spec.md}}

# Your task

Given the current `scenario.yaml`, add steps + any new invariants that reach capabilities this
scenario — ideally NO scenario — has touched, without breaking the story.

## Rules of a good extension
- **SAME PERSON.** Same voice, same domain, same project, later in the same life. The new steps read
  as the next thing that person would naturally do or ask — never a bolted-on feature demo. If you
  can't reach a capability in-persona, pick a different capability, not a different person.
- **REACH FOR THE UNTOUCHED FIRST.** Draw from the deeper surface in the feature map (fork / tasklist
  degraded mode, code nodes, db relations, live schema migration, capability gating at typecheck,
  history summarization, the emitter kinds + loop guard, SSRF guard, consent on a function,
  non-additive schema reconcile). A capability nobody has run is where the bugs are — that is the
  point of a round.
- **NEW INPUT IF NEEDED.** If the capability needs data, add ONE new real fixture (real web or
  Azure-TTS), disjoint token, wired into a step and asserted in real state. Record it in `links.md`.
- **NEVER WEAKEN AN EXISTING `expect`** to make room, and never delete a step to "simplify" — a green
  you get by lowering the bar is a lie.
- **STAY HONEST ABOUT ASKS.** If a new step's correct behavior is to ASK, mark it in `expect` and add
  `if_asked` grounding — don't write a step that only passes if THING guesses.

## For each new step
- Continue the arc; write the verbatim message(s) in-persona.
- Add its `expect` lines (observable on trace / state).
- If it introduces a contract the scenario didn't yet assert, add that GLOBAL invariant from the
  library too — so it's judged on every step from now on.

## Before you finish
- The extended arc still reads as one coherent life, start to end.
- Every hard rule still holds in every message (no product words; THING still proposes; spaces still
  self-created; every fixture token still asserted in state).
- Write a short note naming which capability each new step reaches and confirming it was previously
  untouched.

## Done
The extended `{{SCENARIO_DIR}}/scenario.yaml` (+ any new fixture and `links.md` entry), UNCOMMITTED.
A human reviews and commits; the judge runs it on the next round.
