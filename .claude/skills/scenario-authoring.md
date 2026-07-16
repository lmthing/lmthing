---
name: scenario-authoring
description: Load when creating a NEW scenario or EXTENDING an existing one — a declarative `sdk/org/scenarios/<id>/scenario.yaml` (persona · promise · invariants · steps) played by the generic runner and judged against the three-store contract. Covers the format, the real-fixture rule, the invariant library, and the generalize-never-overfit rule. NOT for running/judging a scenario — that is `@.claude/skills/scenario-campaign-loop.md`.
---

# Skill: Authoring a scenario

Use this when you are writing or growing a scenario for the lmthing product. A scenario is a
**promise a real person makes to themselves**, played as plain-language messages to THING and judged
on every step against invariants — a story that exercises features because a real person's needs
demand them, never a feature checklist wearing a persona.

**All the knowledge lives in the campaign's spec + prompt files.** This skill is the map + procedure.

## Read first (the grounded truth)

- `automation/instances/scenario-campaign/scenario-spec.md` — THE spec: the `scenario.yaml` format,
  the four real-person hard rules, the **three-store contract** (DB row vs space knowledge vs user
  memory), the **invariant library** (pull lines VERBATIM), the feature-surface map, and the
  generalize-never-overfit rule.
- `automation/instances/scenario-campaign/create.md` — the procedure for a brand-new scenario.
- `automation/instances/scenario-campaign/extend.md` — the procedure for growing a green one.
- `sdk/org/scenarios/06-tanzania/scenario.yaml` — the worked example (18 steps, full contract, all
  six fixtures token-asserted). Copy its shape.
- `sdk/org/scenarios/run-yaml.mjs` — the generic runner that plays a `scenario.yaml`. Read its step
  verbs (`attach`/`say`/`then_say`/`open_app`/`in_app_chat`/`fresh_session`/`restart_pod`/`if_asked`/
  `expect`). `attach:` wires files onto the step's `say` ONLY — never `then_say`/`in_app_chat`; a
  beat that delivers a file must be a `say` step. `node sdk/org/scenarios/run-yaml.mjs <id> --plan`
  dry-prints + checks fixture coverage.

## The non-negotiables (each is a FAIL if violated)

1. **The persona knows ZERO lmthing words** — no space/project/app/agent/hook/table/build/… They
   talk about their life. THING *proposes* the app; a bare "yes" is enough. They MAY echo a
   plain-English noun THING itself coined ("the vault", "the tracker") — that's how a person refers
   back, not product vocabulary; a word from the banned list never is.
2. **Every `expect` is OBSERVABLE on the trace or on disk** — a delegate, a yield, a DB row, a
   knowledge file with its `source` line. Never "the reply mentions X" (passes when broken).
3. **Real fixtures, each with a token found in NO other fixture**, and an `expect` asserting that
   token lands in real state (a DB row / space file) — the only proof the file was READ. Grep
   `fixtures/` to confirm tokens are disjoint. Audio via Azure TTS (`sdk/org/.env` keys); verify the
   whisper round-trip. Record provenance in `fixtures/links.md`.
4. **Route every fact by the three-store test** — "would he open a page to look at it?" → DB row;
   "just what an agent needs to advise" → space knowledge; "about him, no app yet" → user memory.
   **Every invariant you list must have a step that exercises it** — e.g. migrate-from-memory only
   fires if the arc states a personal fact BEFORE the app is built; a bulk-dump-then-yes arc has no
   such window, so don't list the migrate invariant it can't test.
5. **`invariants:` are pulled VERBATIM** from the library (they are what the judge reads and what a
   prompt fix must satisfy) — don't paraphrase the contract.
6. **An `ask` is behavior**: where a step's correct move is to ask (ambiguous "don't forget",
   equal-precedence conflict), say so in `expect` and add `if_asked` / scenario `knows` for the
   load-bearing answers. Over-asking is a failure too.

## Procedure — a NEW scenario

1. Pick a real person + real messy problem in a domain no existing scenario owns (05 latam · 06
   tanzania · 07 life-admin · 08 small-shop · 09 home-reno · 10 recipes). Concrete: name, place,
   dates, real objects.
2. Gather ≥3 real fixtures across kinds (image/PDF/xlsx/audio/live-URL), disjoint tokens, `links.md`.
3. Write the arc (see `create.md`): dump+frustration → the OFFER (nothing built) → bare "yes" (spaces
   + DB + app, no research) → the middle (personal read, research-and-store, no-second-search,
   parallel research, total-from-endpoint, correction fixes a row, in-app change, foreign-language
   fact, retraction, conflict, refusal, a legit ask) → durable memory + fresh session → pod restart.
4. Attach `invariants:` (verbatim) + 1–4 observable `expect` per step.
5. Self-audit: read every `say:` aloud as the persona (any product word → rewrite); apply the
   would-open-a-page test to every fact; confirm ≥8 capabilities + ≥2 deeper-surface, coherently;
   confirm zero scenario literals would ever need to enter an agent's brain to pass.
6. `--plan` to confirm every uploadable fixture is attached. Leave it UNCOMMITTED for review.

## Procedure — EXTENDING a green scenario

Same persona/voice/domain, later in the same life. Reach an UNTOUCHED capability first (the deeper
surface in the spec's feature map). Add ≥1 new real fixture if the capability needs data. Never
weaken an existing `expect` or delete a step. See `extend.md`.
