# MIGRATE `{{SCENARIO_ID}}` from prose `scenario.md` to `scenario.yaml`

`{{SCENARIO_DIR}}/` today holds a prose `scenario.md` (Acts / user stories / choreography / feature
coverage / acceptance criteria) plus a rich, real `fixtures/`. Convert it into a single declarative
`{{SCENARIO_DIR}}/scenario.yaml` the generic runner can play — **using EVERY fixture** — so the judge
can score it step-by-step. You do NOT run a pod and you do NOT touch product code. You author the
YAML, validate it with `--plan`, and signal the orchestrator; it reviews and commits.

{{include:scenario-spec.md}}

# Inputs to read first (all of them)

1. `{{SCENARIO_DIR}}/scenario.md` — the FULL design doc. Mine it for: the user flow table, the
   contract + anti-expectations, the background choreography (which store each fact lands in), the
   user stories + their **Accept:** criteria, the feature-coverage matrix, and the acceptance
   **Acts** with their assertions. This is the source of truth for what the arc must cover.
2. `{{SCENARIO_DIR}}/fixtures/` — every file, and `fixtures/links.md` (provenance + the ONE unique
   token each fixture carries). `grep` the fixtures to confirm each token is disjoint; those tokens
   are your proof-of-read assertions. For audio (`*.mp3`), read its `.txt` sidecar for the spoken
   facts.
3. The two reference `scenario.yaml`s — `{{repoRoot}}/sdk/org/scenarios/06-tanzania/scenario.yaml` and
   `07-life-admin/scenario.yaml` — and `{{repoRoot}}/sdk/org/scenarios/_template/scenario.yaml`. Match
   their shape and voice exactly.

# What to produce — `{{SCENARIO_DIR}}/scenario.yaml`

A single spec with these keys (see `scenario-spec.md` for the full format):

- `id` / `title` / `project` — the id is `{{SCENARIO_ID}}`; project is the id the runner creates.
- `bootstrap: thing` — THING starts in the shared `user` space and must `createProject` itself (the
  new model; the `scenario.md` may say "the user clicks New project and names it X" — replace that
  with an in-voice message that leads THING to create it).
- `persona` — who they are, how they talk, **what they never say** (never product words), in their
  voice. Pull it from the `scenario.md` persona/rationale.
- `promise` — the one behavioural promise the judge scores, as outcomes not implementation.
- `knows` — the load-bearing answers the persona gives IF THING asks a legitimate question (from the
  `scenario.md`'s grounded facts / user-story inputs).
- `invariants` — pull the GLOBAL invariants the arc relies on **verbatim from the library** in
  `scenario-spec.md` (data placement, when to research, how agents answer, lifecycle, asking well).
  The `scenario.md`'s anti-expectations usually map onto these.
- `steps` — the ordered beats. Map the `scenario.md` **Acts / user-flow rows** onto ordered steps.
  Each step is one or more verbs + an `expect[]`:
  `attach:[file,…]` · `say` · `then_say` · `in_app_chat` · `open_app: true` · `fresh_session: true` ·
  `restart_pod: true` · `if_asked:{question-substring: answer}` · `deny_consent: true` · `expect:[…]`.
  `attach:` wires files onto that step's `say` message only.

# Rules

- **Use EVERY fixture.** Each file in `fixtures/` (except `links.md` and `*.txt` sidecars) MUST be
  `attach`ed on some step, and its unique token MUST appear in that step's (or a later step's)
  `expect[]` as proof it was actually read (photo LOOKED AT, audio TRANSCRIBED, PDF/xlsx PARSED). The
  `--plan` fixture-coverage audit is the check: it flags any on-disk fixture never attached.
- **Cover what the `scenario.md` covered.** Every user story's **Accept:** and every Act's assertion
  should be reachable from some step's `expect`. Don't drop the hard beats (self-evolution in-app,
  research→store-with-source then the SAME question with NO second search, a total from the app's own
  endpoint, a correction that fixes a row, a retraction, a conflict, a refusal, a personal fact in
  another language, durability across `fresh_session` + `restart_pod`). A deliberately-corrupted
  fixture (e.g. 09's `cq2.pdf`) is asserted as "THING does NOT fabricate — it says it couldn't read
  it", not as a parsed value.
- **`expect[]` is observable, on trace or on disk.** 1–4 lines per step; if you can't name where the
  judge would look to confirm it, it isn't an `expect` yet. Where the correct behavior is to ASK, say
  so in `expect` and add `if_asked` / `knows` grounding.
- **Voice, not PM-speak.** Read every `say:` aloud as the persona — any product word or docs-flavored
  phrasing is wrong. Keep unrelated chatter/drift between load-bearing turns, as `scenario.md` intends.
- **Zero scenario literals leak into product** — this is a scenario file, so its literals belong here;
  the point of migration is that NONE of them ever need to enter an agent's brain for the arc to pass.

# Validate (no pod)

    cd {{repoRoot}}/sdk/org
    node scenarios/run-scenario.mjs {{SCENARIO_ID}} --plan

The plan must PARSE (no YAML/verb errors) and the fixture-coverage audit must show **every** fixture
✅ (attached) — no ⚠️ "on disk but never attached". Iterate until clean. Do NOT start a pod.

# Done

`{{SCENARIO_DIR}}/scenario.yaml` (all sections + invariants + steps) exists, `--plan` is clean with
all fixtures ✅, and the arc faithfully covers the `scenario.md`'s stories/Acts. Leave it UNCOMMITTED
and signal the orchestrator with a short note: how many steps, which fixtures wire where, which
capabilities/Acts each beat reaches, and any beat you believe may expose a real product gap for the
runner round to find.
