# Scenario campaign — `{{SCENARIO_ID}}` · round {{round}} ({{roundMode}})

`{{SCENARIO_ID}}` already has a runner and has been extended in earlier rounds. This round: **add
ANOTHER batch of additional Acts and continue from there.** Never regress the existing Acts —
extension is strictly additive.

1. **Orient & resume.** Read `{{SCENARIO_MD}}` (esp. its Acts table + Actual-results), `{{RUN_MJS}}`,
   and `{{RESULTS_DIR}}/` (report, trace, checkpoint) to see exactly which Acts exist, which passed,
   and any open frontier a prior round recorded. Read this run's `{{progressFile}}` if it exists.
2. **Pick the next batch of Acts (2–4)** from the feature catalog below — capabilities
   `{{SCENARIO_ID}}` still does **not** cover — extending the same persona / same growing project
   realistically (incremental drift, unrelated chatter between load-bearing turns, a re-add/re-ask at
   the end to guard against routing degradation).
3. **Add them to `{{SCENARIO_MD}}` (Acts table + user stories/expectations) AND `{{RUN_MJS}}` (1:1)**,
   keeping every hardening pattern and all prior Acts. Provision, then run the **FULL** scenario live
   (resume from the last good Act via the checkpoint; use `--acts=` to re-run just the new ones while
   iterating, but do a full green pass before reporting).
4. **Triage → fix in the product with a test → verify live → report** exactly as below. Update the
   scenario's **Actual results** with the new verdict, per-Act table, every issue + fix sha, the perf
   table, and the honest narrative. Commit + push both repos (submodule first, then the parent
   pointer) and confirm the deploy.

Everything about how — the artifact format, the feature catalog, the harness API and hardening
patterns, the run/triage/fix/verify/report loop, and commit discipline — is below.

{{include:prompt.common.md}}

Begin now: orient (scenario + results + runner), then add and run the next batch of Acts.
