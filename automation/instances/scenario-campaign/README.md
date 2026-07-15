# scenario-campaign instance

Runs each scenario in `sdk/org/scenarios/<id>/` — now a single declarative **`scenario.yaml`**
(persona · promise · invariants · steps) plus **`fixtures/`** — end-to-end against a LOCAL
`lmthing serve`, **judges every step** on the execution trace + real state, and on the FIRST failure
**fixes it at the right rung** (L0 scenario / L1 prompt / L2 structure / L3 framework) and **proves
the fix with a fresh rerun**. One failure per invocation; if a scenario is fully green, the judge
authors ONE extension and stops. There is **no per-scenario `run.mjs` and no `results/` dir** — a
generic YAML runner plays the steps, and the judge's report lives beside its progress log in the
round-artifact tree.

## The prompts

| File | Role |
|---|---|
| `scenario-spec.md` | shared foundation: the `scenario.yaml` format, the four real-person rules, the three-store contract, the invariant library (incl. "Asking well"), the feature map, generalize-never-overfit. `{{include}}`d by the three below. |
| `judge.md` | the round template — run → judge → answer THING's questions in-persona → on first failure fix at the right rung → verify with a fresh rerun → stop; extend if fully green. **Never commits.** |
| `create.md` | manual entrypoint: author a brand-new `scenario.yaml` + real fixtures. |
| `extend.md` | grow an existing green scenario in-persona toward an untouched capability. |
| `prompt.continue.md` | cross-account resume wrapper that honors never-commit. |

## The human is the commit gate

The judge **never commits** — it leaves its changes uncommitted with a full report (the interface to
review). **A human reviews the diff against the report and commits directly to `main`.** So this
instance runs **serially** (`maxParallel: 1`) and is meant to be driven **one scenario at a time**:

```bash
node automation/lmauto.mjs run scenario-campaign --dry-run    # preview the next run's prompt
node automation/lmauto.mjs run scenario-campaign              # ONE run, returns (next in rotation)
node automation/lmauto.mjs run scenario-campaign 06-tanzania  # force a specific scenario
node automation/lmauto.mjs tui scenario-campaign              # dashboard
```

After each run: review the uncommitted product diff, then commit it to `main` yourself. Only then
run the next scenario (a clean tree keeps runs independently reviewable). The engine's own ledger +
round-artifact commits are path-limited and never touch the product diff.

## Notes

- **Local target.** `SCENARIO_TARGET=local` is pinned in `config.mjs` — one shared `lmthing serve` on
  `localhost:8080`, budget-free Azure keys from `sdk/org/.env`, each run in its own fresh `projectId`.
  Rebuild + restart IS the deploy; no CI / image / kubectl / ArgoCD.
- **Backup accounts.** Add bins in `config.mjs` (`claude.bins`) to keep going across a usage-limit
  reset; `prompt.continue.md` resumes the same scenario without committing.
- **Tasks** = scenario ids in `config.mjs`. Append an id to fold a scenario in.

## Prerequisites (not yet built)

1. **A generic YAML runner** in the harness that plays `scenario.yaml` steps and exposes the trace to
   the judge (the old bespoke `run.mjs` per scenario is retired).
2. **The `scenario.yaml` files** — author them with `create.md`; the old `scenario.md` + `run.mjs`
   pairs predate this model. (`prompt.first/next/common.md` — the old Acts-era prompts — were removed;
   recover from git history if a distilled recipe, e.g. the chrome-devtools browser-verification
   steps, needs to migrate into the generic runner.)
