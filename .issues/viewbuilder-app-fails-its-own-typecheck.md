# The view-spec app THING shipped does not typecheck and does not serve (17 errors, 0 endpoints)

**Symptom** (scenarios/20-studio run 4 step 12, 2026-07-31): after a 968-second build that THING
reported as finished, the app the team was told to open answers **404**, and the pod's own
authoritative check rejects it.

`runs/4/step-12.json`:

```json
"appBuild":  { "built": null, "error": "POST /api/projects/fold-studio-job-tracker/app/build → 400: {\"error\":\"Unhandled error while creating Base Type.\"}" },
"appCheck":  { "ok": false, "errorCount": 17 },
"appPageStatus": 404
```

The first errors, all in one generated file:

```
typecheck api/jobs-create/POST.ts:9   Property 'name' does not exist on type 'JobsCreateInput'.
typecheck api/jobs-create/POST.ts:10  Property 'kind' does not exist on type 'JobsCreateInput'.
typecheck api/jobs-create/POST.ts:14  Property 'deadline_note' does not exist on type 'JobsCreateInput'.
typecheck api/jobs-create/POST.ts:15  Property 'blocker_note' does not exist on type 'JobsCreateInput'.
typecheck api/jobs-create/POST.ts:21  Object literal may only specify known properties, and 'name' does not exist in type 'JobsCreateItem'.
```

The handler reads and writes four fields the generated input type does not declare — the endpoint
and its contract were authored from different pictures of the same table.

## The specs and the data are fine; the wiring is not

Same step's `viewFacts`:

```json
{ "specCount": 6, "specRoutes": ["create-job","index","job/[id]","jobs/[id]","jobs/create","jobs/detail"],
  "componentCount": 2, "shellAuthored": true, "endpointCount": 0 }
```

Three real rows exist (`appTables: {"jobs": 3}`) and six view specs were authored — but
**`endpointCount: 0`**, so no spec has an endpoint to fetch through. A native client rendering these
specs has nothing to call. Note also the duplicated route family: `create-job` *and* `jobs/create`,
`job/[id]` *and* `jobs/[id]` *and* `jobs/detail` — six specs for what looks like three screens.

## Why this was not visible until now

Every earlier run either built into the shared `user` project or never got a spec app this far, so
step 12 was the first honest look at a finished viewbuilder app. It is also why the failure matters:
`open_app` is the only step in the scenario that asks the pod whether what it built actually works,
and every conversational step before it reported success.

Note `appBuild` and `appCheck` disagree in the usual direction — the build route 400s outright here,
but even where esbuild succeeds it will bundle an app the typecheck rejects, which is why the
harness records both (`lib/runner.mjs` has carried that warning since 06-tanzania run 34).

## Evidence

- `sdk/org/scenarios/20-studio/runs/4/step-12.json` — build error, 17 check errors, page 404
- `sdk/org/scenarios/20-studio/runs/4/data/.lmthing/fold-studio-job-tracker/api/jobs-create/POST.ts`
  and `.../types/generated.d.ts` — the handler and the contract that disagree
- `sdk/org/scenarios/20-studio/runs/4/step-02.json` — the build that produced it
  (`delegates: ["system-viewbuilder"]`)

## Verify a fix

Play 20-studio through step 12. `POST /api/projects/:id/app/check` must return `ok: true`, the served
page must be 200, and `viewFacts.endpointCount` must be non-zero — a spec app whose views cannot
fetch is not a working app, however many specs it has.
