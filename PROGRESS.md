# Zero-error app builds — progress

**Goal:** a fresh `build_live_project` finishes with **zero `[error]` lines** and never invokes
`repair_live_project`. Then the follow-on loop (features, fixes, data entry, space agents) works.

## Scoreboard

Runs come from `sdk/org/scenarios/parallel-build.mjs` (fresh project + new session per run, one
provider slot per concurrent lane, preflighted). These are **stochastic** — judge a change against
prior runs, never against a single result.

| Batch | Date | Idea | Model | `[error]` lines | repair? | PASS |
|---|---|---|---|---|---|---|
| 1 | 09-01 01:0x | recipe box | `azure:DeepSeek-V4-Flash-0731` | **36** | yes | no |
| 1 | 09-01 01:0x | gym workout log | `azure:DeepSeek-V4-Pro` | **133** | yes | no |
| 2 | 09-01 02:5x | gym workout log | `azure:DeepSeek-V4-Pro` | **69** | yes | no |
| 2 | 09-01 03:0x | recipe box | `azure:DeepSeek-V4-Flash-0731` | **92** | yes | no |
| 3 | 09-01 03:5x | recipe box | `azure:DeepSeek-V4-Flash-0731` | **66** | yes | no |
| 3 | 09-01 03:5x | gym workout log | `azure:DeepSeek-V4-Pro` | **52** | yes | no |

> **Batch 1 is NOT comparable to later batches.** It ran before the typed view writers, when malformed
> specs were accepted silently and failed later at ajv or not at all. Its lower count means fewer
> *detected* failures, not a better app — the skeleton problem showing up in the metric itself. Compare
> batch 2 onward.
>
> Trend on comparable batches: Flash 92 -> 66, Pro 69 -> 52.

Note: run 2's higher count is not simply "Pro is worse" — it produced 19k log lines vs 7k, i.e. it
attempted considerably more work, so it had more opportunities to fail. Compare like-for-like ideas
before drawing a conclusion about models.

### Batch 1 → 2, like-for-like (gym log on Pro): 133 → 69

The total halving matters less than WHICH classes went away. These vanished from the census entirely,
each one traceable to a specific fix:

| Gone | was | fix |
|---|---|---|
| `Argument of type '{ route; sections: unknown[] }' …` + the whole vague `not assignable to ViewSpec` tail | 5 + ~25 singletons | plan-artifact-is-not-the-spec, plus inline-literal authoring (freshness) |
| `Property 'raw' does not exist` | 4 | the note moved INSIDE the injected DTS |
| `Variable 'w' is used before being assigned` | 3 | named the message next to the one-statement rule |
| `a "create"/"update" needs a "set" map` | 2 + 2 | a copyable dual-branch example + the rejection now names the table's columns |

One class went the WRONG way: `a handler imports from "../../types/contract"` rose 2 → 4 and is now the
top error. The knowledge layer was updated but the api-author's own EXAMPLE was not — and the example is
what gets copied. Routed as task 14.

## Fixed and pushed

| Class | Root cause | Where |
|---|---|---|
| prose evaluated as code | `looksLikeProse` bailed on any code punctuation, so prose *about* code (`` `views/books/[id]` ``) was executed | `eval/turn-loop.ts` |
| `Cannot find name 'f'/'pg'/'ep'` | fork/delegate lost accumulated context across the forced-resolve nudge; `session.ts` already did it right | `fork/fork.ts`, `delegate/delegate.ts` |
| `Parameter 's' implicitly has an 'any' type` | `noImplicitAny` at the dynamic agent-value boundary | `typecheck/tsc.ts` |
| view specs failing only at ajv | the four writers took `spec: unknown`; now generated `ViewSpec` types + `defineViewSpec` + a drift gate | `typecheck/library-dts.ts` |
| `Property 'raw' does not exist` | `.raw` exists on the ENGINEER's scratch `readFile`; the note was first written OUTSIDE the injected DTS string where the model could never see it | `typecheck/library-dts.ts` |
| `Unexpected end of JSON input` | fix templates called `JSON.parse(cur.content)` where `readProjectFile` returns `content: ''` for a missing file | `17-fix.md`, `02-fix_broken.md` |
| read-only apps | no write floor, `prefill` taught nowhere, no gate; 4/4 apps could not edit or delete | `05-plan_endpoints.md`, `07-plan_views.md`, `08-validate_contract.ts` |
| no delete path | `QueryKind` had no `delete`; authoring surface was write-only | `ir/query.ts`, `authoring/globals.ts` |
| follow-on routed to build | `grow-project.md` / `add_area` delegated `build_live_project` for changes to an app that exists | user-thing playbooks |
| no bulk data entry | seeding was deferred to a job implemented nowhere | `iterate_live_project/06-enter_data.md` |

## Open — dispatched

| Class | Count | Agent |
|---|---|---|
| plan object passed into `writeProjectView` (`purpose`/`endpoints`/`components` are PLAN fields) | 8+ | pi-glm |
| `create`/`update` needs a `set` map | 4 | pi-terra |
| invented relative import `../../types/contract`; `used before being assigned`; `unknown` values; reader result passed where a string is wanted | 9 | pi-deepseek-flash |

## Operating rules learned the hard way

- **Never exceed 6 subagents** — 8 restarted the whole herdr session and lost 5 in-flight tasks.
- **Live builds and Azure-backed agents share ONE Azure resource.** Running both starves the agents
  (`Request timed out`). Curl the endpoint first to rule out an outage/bad key, then read the pane's
  context gauge before blaming the provider.
- **A CLI flag parsing is not proof its value resolves.** The harness's first run reported
  `FAIL / 0 [error] lines` from an invalid model spec — a harness bug wearing the costume of a product
  result. It now preflights every slot with a real completion and reports VOID distinctly.
- **Poll the report artifact on disk**; `agent_status` and `--wait` lie.
- Verify every agent test claim by re-running it.
