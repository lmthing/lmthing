# Scenario campaign — `{{SCENARIO_ID}}` · round {{round}} ({{roundMode}})

This is the **first round** for `{{SCENARIO_ID}}`. Two goals, in order:

**1. Reach a green baseline.**
- Read `{{SCENARIO_MD}}`. If `{{RUN_MJS}}` does **not** exist yet, scaffold it from
  `sdk/org/scenarios/_template/run.mjs` and implement the Acts already described in `{{SCENARIO_MD}}`
  (1:1 with its Acts table), reproducing the literal user flow. If it exists, read it and confirm its
  Acts still match `{{SCENARIO_MD}}`.
- If `{{SCENARIO_MD}}` itself is a stub (some scenarios only have a title/idea — check
  `sdk/org/scenarios/IDEAS.md` and the `_template/scenario.md` structure), first author the six
  sections into a coherent, realistic scenario with a small initial set of Acts, then build its
  runner.
- Provision a disposable prod user and run the baseline Acts end-to-end **live** until they pass (or
  are honestly recorded as failing with a triaged cause). Fix any product bug you hit, with a test.

**2. Add a FIRST batch of additional Acts (2–4).**
- Choose them from the feature catalog below — capabilities `{{SCENARIO_ID}}` does **not** yet cover
  — extending the scenario naturally (same persona, same growing project, realistic drift).
- Add each new Act to `{{SCENARIO_MD}}`'s Acts table (+ any new user stories / expectations) AND to
  `{{RUN_MJS}}` (1:1), keeping every hardening pattern. Run the FULL scenario (old + new) live,
  triage, fix in the product with a test, verify live, and report.

Everything about how to do this — the artifact format, the feature catalog, the harness API and
hardening patterns, the run/triage/fix/verify/report loop, and the commit discipline — is below.

{{include:prompt.common.md}}

Begin now: orient (read the scenario + its results + the harness), then work goals 1 then 2.
