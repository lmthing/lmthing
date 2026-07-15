# Author a NEW lmthing scenario — `{{SCENARIO_ID}}`

You are AUTHORING one brand-new scenario as `{{SCENARIO_DIR}}/scenario.yaml` plus its fixtures. You
do NOT run it and you do NOT touch product code — the judge takes it from here, and a human reviews
and commits. Your whole job is a coherent, honest, feature-rich `scenario.yaml` and real fixtures.

{{include:scenario-spec.md}}

# Your task

Invent a real person with a real, messy, ongoing problem in a domain no existing scenario owns
(existing: latam travel, tanzania trip, life-admin, small-shop, home renovation, family recipes).
Give them files worth dumping and a frustration worth solving, and write the arc.

## Build the arc in this order
1. **PERSONA + PROMISE + PROJECT.** One real person, one sentence of what they're drowning in, one
   product claim under test. Concrete: a name, a place, real dates, the actual objects (a kiln, four
   rental units, a race calendar).
2. **FIXTURES — real files from the real web.** At least three, across kinds (image, PDF,
   spreadsheet, audio via Azure TTS, a live URL). Each carries ONE token present in no other fixture;
   grep `fixtures/` to confirm disjoint. Record provenance in `fixtures/links.md`. A hand-invented
   fixture (`Item A — €10`) is one the agent can guess — the point of real files is that they catch
   the bug.
   - Audio: generate with Azure TTS (`tts` deployment on `$AZURE_RESOURCE_NAME`, key `$AZURE_API_KEY`,
     both in `sdk/org/.env`); write a spoken monologue with hesitations, do at least one in the
     persona's own language, and verify the round-trip through whisper before relying on it.
3. **THE OPENING.** A dump + a plain frustration. `expect`: every file actually read (proved by its
   token later), an OFFER naming ≥2 real specifics of theirs, and NOTHING built yet.
4. **THE "YES".** Spaces created (one per real sub-topic, each with its own agent), the user's data
   landed in DB tables, an app built on them and served — and NO research (everything was handed
   over). If any personal fact was stated before this, `expect` it MIGRATED from memory into a row.
5. **THE MIDDLE — a real conversation, not a tour.** Weave in, in an order a real person would hit
   them: a personal read (`db.query`), a topic question that misses knowledge and triggers
   research→store-with-source, the SAME question again with NO second search, a parallel multi-topic
   research, a total that must come from the app's own endpoint, a correction that FIXES a row, an
   in-app-chat change, a personal fact in another language, a retraction, a conflict, a refusal, a
   legitimate clarifying question (with `if_asked` grounding). Keep unrelated chatter and drift
   between load-bearing turns — a promise that only holds on a scripted happy path isn't kept.
6. **THE TAIL.** A durable "remember this for good" + a `fresh_session` that still knows it; then a
   `restart_pod` that everything survives.

## Attach invariants
- Put the GLOBAL invariants your arc relies on in `invariants:` (judged on every step) — pulled
  verbatim from the library, not paraphrased.
- Give every step 1–4 `expect` lines, each observable on the trace or on disk. If you can't name
  where the judge would look to confirm it, it isn't an `expect` yet.
- Where a step's correct behavior is to ASK, say so in `expect` ("it ASKS whether ... — asking is
  correct here") and add `if_asked` / scenario-level `knows` for the load-bearing answers.

## Before you finish — self-audit
- Read every `say:` aloud as the persona. Any product word or docs-flavored phrasing → rewrite.
  Would only a PM write it? → rewrite.
- Apply "would he open a page to look at it?" to every fact the arc touches; confirm each step routes
  it to the right store.
- Confirm the arc reaches ≥8 distinct capabilities and at least two from the deeper surface —
  coherently, because the person needed them, not because a checklist did.
- Confirm zero scenario literals would ever need to enter an agent's brain for the arc to pass.

## Done
`{{SCENARIO_DIR}}/scenario.yaml` (all sections + invariants + steps), `fixtures/*` with disjoint
tokens, and `fixtures/links.md`. Leave it UNCOMMITTED — a human reviews and commits. Write a short
note of what the arc covers and any step you deliberately authored as an L3 discovery (a capability
the framework may not satisfy yet).
