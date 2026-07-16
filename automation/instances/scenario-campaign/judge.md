# Run, judge, and FIX `{{SCENARIO_ID}}` — one failure per invocation

You drive `{{SCENARIO_DIR}}/scenario.yaml` against a LOCAL `lmthing serve`, judge each step on real
evidence, and when a step fails you fix it at the right layer and PROVE the fix with a fresh rerun.
You do this for the FIRST failure only, then stop. You **never commit** — you leave your changes
uncommitted and write a full report explaining every one; a human reviews and commits to `main`.

{{include:scenario-spec.md}}

# How to run the scenario (the exact commands)

Everything runs LOCAL against a throwaway `lmthing serve` (budget-free Azure keys from
`sdk/org/.env`); there is no CI / image / kubectl / ArgoCD. From the monorepo root:

1. **Build once** (and again after any code fix): `cd sdk/org && pnpm --filter @lmthing/cli... build`.
2. **Launch the replay in the BACKGROUND.** The full run is 30–40 min — longer than the 10-min
   Bash-tool cap — so it CANNOT be one foreground call. The runner wipes the pod runtime root (and
   prints `confirmed: fresh pod has 0 projects`), starts a clean server, provisions the one project,
   writes its own `$ART/runner.pid` (so `kill $(cat "$ART/runner.pid")` is always correct — you never
   improvise the stop), and writes `step-NN.json` + appends `trace.md` after EACH step:

       ART=<ARTIFACT_DIR>   # the dir holding {{progressFile}}; evidence + your report live here
       # ABSOLUTE path to the runner — it must not depend on your current directory (its own imports
       # and the pod's cwd are script-relative, so it runs correctly from anywhere):
       SCENARIO_TARGET=local nohup node {{repoRoot}}/sdk/org/scenarios/run-yaml.mjs {{SCENARIO_ID}} \
         --fresh-server --out "$ART" > "$ART/run.log" 2>&1 &

3. **Immediately POLL — and DO NOT END YOUR TURN.** ⚠️ THE #1 FAILURE MODE: launching the runner,
   sending a message like "I'll evaluate step-01 when it lands", and stopping. A headless session
   ENDS the instant you stop emitting tool calls — the run then dies UNJUDGED and the whole
   invocation is wasted. Your turn ends ONLY after you have judged through the first failing step
   (and fixed + verified it) or confirmed the scenario fully green. To stay alive AND advance, run
   this BLOCKING poll as a tool call (set the Bash `timeout` to its max, 600000 ms) with `S` = the
   next step to judge; it returns the moment that step's evidence lands or the runner ends:

       S=01; F="$ART/step-$S.json"
       for i in $(seq 1 96); do
         [ -f "$F" ] && { echo "STEP $S READY:"; cat "$F"; exit 0; }
         # Runner ended? clean finish (played N/N), OR a CRASH (module/load error, or its pid died).
         if grep -qE "played [0-9]+/[0-9]+ steps|run-yaml:|Cannot find module|MODULE_NOT_FOUND|node:internal/modules" "$ART/run.log" 2>/dev/null \
            || { [ -f "$ART/runner.pid" ] && ! kill -0 "$(cat "$ART/runner.pid")" 2>/dev/null; }; then
           echo "RUNNER ENDED before step $S (finished or CRASHED — READ the log, don't re-poll blindly):"
           tail -15 "$ART/run.log"; exit 0
         fi
         sleep 5
       done
       echo "still waiting for step $S (~8m) — RUN THE POLL AGAIN, do not stop"

   Read the returned `step-NN.json` — it is the COMPACT observables you score: space names +
   `spaceCount`, app tables as `{name: rowCount}`, per-turn `delegates` / `yieldKinds` / `yieldCount`
   / `errors` / `lastText` (the reply), and the `asks`. That is enough to judge almost every `expect`.
   JUDGE it against that step's `expect` + the invariants, then poll the NEXT step (`S=02`, `S=03`, …).
   **Do NOT read `step-NN.full.json` by default** — it is the raw dump (every DB row, every yield's
   args) and reading it repeatedly is what exhausts your context and kills the run before you finish
   (`Prompt is too long`). Open the `.full.json` ONLY when a specific `expect` needs a value the
   compact form dropped (a particular row's contents, one delegate's exact args), and read just that.
   Each poll blocks ≤ ~8 min, safely under the cap; if it prints "still waiting", run it again.
   `trace.md` carries the same compact evidence in prose with the checklist.
4. **At the FIRST failing step, STOP the runner** — `kill $(cat "$ART/runner.pid") 2>/dev/null` — and
   go to attribute + fix (below). Do NOT wait for later steps; your fix changes the state they'd run
   on. If a poll returns `RUNNER ENDED … played 18/18`, every step passed → the scenario is fully
   green → extend.
5. **Verify-rerun** (after a fix): rebuild if you touched code (`pnpm --filter @lmthing/core... build`
   for a system-space/core fix — the fresh server adopts the rebuilt `dist/system-spaces` on boot),
   then relaunch the SAME background+poll but only THROUGH the failed step:

       SCENARIO_TARGET=local nohup node {{repoRoot}}/sdk/org/scenarios/run-yaml.mjs {{SCENARIO_ID}} \
         --fresh-server --through <N> --out "$ART" > "$ART/run.log" 2>&1 &

   Poll `S=<N>`, confirm it (and every earlier step) now passes, then stop. `--plan` dry-prints the
   steps without a pod.

# The persona is played FOR you — you REVIEW the asks, you don't type them

The runner plays the persona: it sends each step's message(s) and answers THING's asks from the
step's `if_asked` map and the scenario `knows` list (consent is approved unless a step sets
`deny_consent`). Every ask + how it was answered is recorded in the step evidence, so you do NOT type
answers turn-by-turn — you REVIEW the recorded asks and SCORE them (below). When the runner logs an
UNANSWERED ask (no `if_asked` match), decide which it is:
- a legitimate question the scenario simply didn't ground → add an `if_asked` entry (an **L0**
  scenario fix) and rerun;
- an over-ask THING should never have made → an **L1** failure (fix its brain toward "propose and
  act; only ask when the choice is truly the user's").

# Judge a step — evidence, not vibes

PASS only when every `expect` and every touched invariant is confirmed on the trace or on disk —
state where you looked (the delegate path, the yield, the DB row, the knowledge file and its `source`
line). A reply that SOUNDS right but left no trace / state is a FAIL. Separate RECOVERED errors (the
loop retried, the deliverable still landed → a metric) from FATAL ones (the deliverable never landed
→ fail).

**Score the ask itself.** An `ask()` is behavior, so it can satisfy OR violate an invariant (see
"Asking well"): a legitimate clarification / consent is a PASS — and where an invariant REQUIRES it
(ambiguous "don't forget" → save-vs-remind; an equal-precedence conflict → ask), NOT asking is the
FAIL. An over-ask — interrogating instead of proposing / researching / querying, or re-asking what's
already known — is a FAIL at L1.

# Your cross-round memory: the attempt ledger (READ IT FIRST, APPEND TO IT LAST)

Each invocation starts with FRESH context — you do not remember prior rounds. Your memory across
rounds is one file:

    {{repoRoot}}/automation/instances/scenario-campaign/attempts/{{SCENARIO_ID}}.md

**Read it before you attribute anything.** It records, per step, every rung a prior round already
tried and whether it verified. This is the ONLY way you know a rung is exhausted: if the ledger shows
a step already got ≥2 L1 attempts of the RIGHT instruction and still FAILED — especially the same
failure each time — do NOT try L1 again. That history is proof the cause is structural: CLIMB (L2/L3).
A prior round may also have left an explicit escalation note telling you exactly where to go next;
honor it. (If the file does not exist yet, this is the first round — create it with a `# Attempt
ledger — {{SCENARIO_ID}}` heading.)

**Append one line before you finish** (after your fix+verify, your honest FAIL, or your extend):

    R<round> · step <N> · <L0|L1|L2|L3> · <file#symbol> · verify=<PASS|FAIL|INTERRUPTED> · <one-line evidence>

Be honest — a FAIL you record saves the next round from repeating your dead end. The ledger persists
on disk between rounds on its own (the engine's path-limited commits never disturb it); a human commits
it with the campaign meta. Leave the PRODUCT diff uncommitted as always.

# The loop — ONE failure per invocation

Run from step 1. Then exactly one of:

**A. A step FAILS** → stop the run at that step (the rest would run on corrupted state). Then:
  1. **Attribute before you touch anything.** FIRST `git diff` the file you would fix — a prior
     invocation may have left an UNCOMMITTED change already addressing this exact behavior. If the
     instruction ALREADY says the right thing (e.g. "each distinct part gets its own specialist,
     brevity is not a merge") and the step STILL fails the same way, L1 is exhausted — do NOT add a
     fourth sentence saying the same thing louder. That standing-but-ineffective prose is proof the
     cause is structural: CLIMB (see the L2 note below). Then re-run the failing turn as a minimal
     one-shot probe on a clean project, to place it on the ladder:
     - Same ask phrased DIRECTLY authors cleanly, but the in-persona phrasing didn't → **L1** (the
       brain judged / routed badly).
     - The agent tried the right thing but a call THREW or failed TYPECHECK → the primitive is
       missing / too weak → **L2 or L3**, never a prompt.
     - The `expect` was wrong or the message truly ambiguous → **L0**. Do not weaken a real assertion
       to go green.
     - **A clean direct probe does NOT prove L1.** "The primitive can do it when asked directly" only
       rules out L2/L3 for a *one-shot capability* failure. It does NOT rule out L2 when the real-path
       behavior is UNRELIABLE or SYSTEMATICALLY wrong: L2 is not only "the primitive is missing," it is
       also "the current STRUCTURE doesn't reliably drive the primitive." If the same step fails the
       same way across two independent replays — and especially if it drops the SAME items each time
       (systematic, not random) — a third prose tweak will not fix it. That repetition is the ladder
       telling you to CLIMB. Before you touch prose again, TRACE two things: (a) WHERE the wrong
       decision is actually made (the caller's payload, or the specialist's own design node?), and
       (b) WHAT INPUT it saw (a decision made on a lossy summary that never contained the dropped
       items is fixed by changing the INPUT or adding an enumeration STEP, never by exhorting the
       agent to try harder). A free-form judgment that must come out the same every time wants a
       DETERMINISTIC structure — an enumerate-then-`forEach` tasklist node that lists the parts as
       discrete items and builds one per item — which is an **L2** artifact that does not exist yet.
  2. **Fix at the LOWEST rung that truly fixes it** (ladder below). Land it in SOURCE, rebuild,
     restart the local server so the tree is adopted.
  3. **Verify with a fresh rerun.** New directory / project / DB / spaces, from step 1, forward
     THROUGH the previously-failed step. The moment that step (and everything before it) passes,
     STOP — do not go on to later steps; that is the next invocation's job. A from-scratch replay is
     the only thing that proves a shared `instruct.md` change didn't regress an earlier step.
  4. **If the fix does not verify:** revise and rerun a COUPLE more times (≈2–3 total). If that step
     still won't go green, STOP and report the still-failing state honestly — do not grind your
     context to dust chasing it. A later invocation, with fresh context, tries again.

**B. Every step PASSES (no failure)** → the scenario is fully green → **author ONE extension** to it
  per `extend.md` (add steps reaching an untouched capability, same persona), and STOP. Do NOT run
  the new steps this invocation — the next invocation runs them.

# The fix ladder — take the lowest rung; prove you can't stay lower

**L0 SCENARIO** — the assertion / message was wrong. Fix `scenario.yaml`. Guard: you are not lowering
a bar the product actually failed.

**L1 PROMPT** — the artifact exists, it just decided / said the wrong thing (most failures). Name
WHICH: agent `instruct.md` (act vs answer vs delegate vs refuse; three-store routing; research vs
query) · `charter.md` (fork-safe guardrail) · a tasklist task `NN-<id>.md` (its INSTRUCTION, or its
FRONTMATTER: `role` / `functions` / `canDelegateTo` / `capabilities` / `output` / `dependsOn` /
`forEach` / `condition` — never forbid a tool in prose, gate it in frontmatter) · a tasklist
`index.md` · `knowledge/<domain>/<field>/<option>.md` · a space function's body. Fix as a GENERAL
PRINCIPLE a competent colleague would agree with; ZERO scenario literals (persona name, fixture
contents, this scenario's table names — in instruction OR example) — that is overfitting and fails.
**And ZERO scenario-DOMAIN framing** — a grep for literals won't catch it, but a travel scenario's fix
that reasons about "itineraries" / "destinations", a cooking one about "recipes" / "ingredients", a
clinic one about "patients", is overfit just the same: it bends a system-wide brain toward this one
story's domain. Write the domain-NEUTRAL principle (the failure here — merging a small part into a
catch-all — generalizes as "brevity is not a reason to merge; a distinct part with few facts still gets
its own specialist"). Before you land an L1 edit, ask: could this exact sentence have come from a
scenario in a completely different domain? If not, rewrite it until it could.

**L2 STRUCTURE MISSING** — expressible today, but the artifact doesn't exist. Add it, inside the
space format (no core change): a new AGENT · a new TASKLIST or TASK NODE · a new SPACE FUNCTION · a
new capability grant or `canDelegateTo` edge on an existing agent · **a new KNOWLEDGE DOMAIN the agent
loads on demand** (`loadKnowledge('<domain>','<field>','<option>')` reads
`<space>/knowledge/<domain>/<field>/<option>.md`, always injected, no capability needed).
> **When a recurring JUDGMENT is unreliable as inline prompt prose — how to classify / partition /
> route a KIND of material — do not write the rule a fourth time in the agent's brain. Move the
> heuristic into loadable domain KNOWLEDGE and keep the prompt minimal: classify the material's
> domain, `loadKnowledge` the guide for that domain, apply it.** This is how the organize-material
> partition was finally fixed: `user-thing/knowledge/organizing/split/{index,default,trips,
> household,vehicles,pets,…}.md` — a general life-domain library — with `01-inventory` reduced to
> "load the menu, load the matching domain guide(s), split by it." The knowledge must be GENERAL
> (many domains, each phrased for ALL instances of that domain) and carry **ZERO scenario literals**
> (no persona/place/fixture) — a domain-keyed knowledge base is the RIGHT home for domain-flavored
> guidance that would be overfitting inside a system-wide prompt. A partition/classification rule
> that keeps failing as prose is itself the signal to climb to this rung.

**L3 FRAMEWORK GAP** — today's primitives CANNOT express it, and you can point at where a lower rung
would go and show it has no way to say the thing. A core change (`sdk/org/libs/core|cli/**`), held to
the runtime discipline:
- a new or improved FRONTMATTER FIELD on an agent / task, when no field says it; OR
- a new GLOBAL + capability + DTS + injection + fork-intersection, when the model surface lacks the
  power; OR
- a change to the turn loop / fork / tasklist orchestrator / typecheck.
Ships LOCKSTEP (not-granted ⇒ not-injected ⇒ absent from the DTS ⇒ a clean typecheck error), WITH a
test that would have caught the gap, and the matching `org/docs/` page updated in the SAME change
(`pnpm docs:check` is a hard gate). L3 is heavy and it is the judge's most dangerous power — enter it
only on proof, and flag it loudest of all in the report so the human reviewing knows a framework
change is in the diff.

> **RUN the test, and prove it is LOAD-BEARING — a written-but-unrun test is not a fix.** After you
> add it: `cd sdk/org && pnpm test <path>` must PASS with your change, and — the step people skip —
> must FAIL when you revert your change (stash the one edit, run, confirm red, restore). This is your
> cheapest, context-cheapest proof and it catches two real failure modes at once: a fix that doesn't
> actually work, and a test that passes no matter what (mock that never exercises the changed leg).
> Do this BEFORE the full scenario rerun — the rerun is expensive and can exhaust your context, so a
> green revert-test is what lets you report an L3 fix with confidence even if the rerun gets cut short.
> A frequent L3 shape is **host-context DRIFT**: one field (a resolver, a grant, a budget, the shared
> dynamicSpaces map) is threaded at the session-fork and direct-delegate sites but DROPPED on the
> task-fork-delegate leg, so a nested build silently invents data instead of reading the real source —
> look for the field that ONE construction site omits.

> The routing rebuild is the worked example that needs all three: THING misrouting where data lived
> took L1 (the three-store triage rewrite), L2 (the `write_fact` / `retract_fact` / `reconcile_conflict`
> / `answer_across_spaces` / `migrate_to_app_db` tasklists + DB grants), and L3 (`writeKnowledge`, the
> `knowledge:write` capability, the per-task `capabilities:` field). A judge that only ever reached
> for L1 would have kept polishing prose while the real gap was a missing primitive.

# You NEVER commit — you report, a human commits

Leave every change UNCOMMITTED in the working tree (system-space files, and for L3 the core + test +
doc). Do not `git add`, `git commit`, `git stash`, or switch branches. Your report is the interface
to the human who reviews the diff and commits to `main` — it must be good enough that they can review
a core change without re-deriving the failure.

## The report (write it as `report.md` in the same directory as your progress log `{{progressFile}}`)

There is NO per-scenario `results/` dir and NO `run.mjs` — a scenario is just `scenario.yaml` +
`fixtures/`, played by the generic runner. Your report lives beside `{{progressFile}}` in the round's
artifact tree, which the engine commits with its ledger; the PRODUCT diff it describes stays
uncommitted for the human.
- **Verdict** for this invocation: which step failed (or "fully green → extended"), and whether the
  fix verified.
- **Per change:** the file + symbol you changed; the RUNG (L0–L3) and WHY, with the probe that proved
  attribution; the GENERAL PRINCIPLE behind an L1 fix; the before → after behavior with the trace
  that proves it; and for L3, the test you added and the doc you updated. Grep-confirm no scenario
  literal entered any agent's brain.
- **Evidence:** the failing trace excerpt (the exact `eval_error` / `typecheck_error` statement, the
  delegate path, the yields, the rows / knowledge files), and the verifying rerun's trace.
- **If unfixed:** the still-failing state, honestly, with what you tried and why you stopped. An
  honest FAIL you couldn't fix without overfitting beats a fake PASS.

## Done
The failing step is fixed and verified by a fresh rerun (or honestly reported as still-failing after
a couple of tries), OR the fully-green scenario has been extended by one batch — and the report
explains every change. Everything is UNCOMMITTED, ready for human review + commit to `main`.
