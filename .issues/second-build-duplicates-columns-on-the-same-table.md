# A second build on the same table adds a PARALLEL set of columns instead of reusing the existing ones

**Symptom** (scenarios/20-studio run 2, after steps 6 and 3, 2026-07-31): the `press_checks` table
ends up modelling every fact twice, under two names, with two different status vocabularies.

`sdk/org/scenarios/20-studio/runs/2/data/.lmthing/user/database/press_checks.json`:

| the fact | first build's column | second build's column |
|---|---|---|
| which job | `job_name` | `job_id`, `job_title` |
| when | `date` | `checked_at` |
| who | `checked_by` | `operator` |
| outcome | `result` — enum `passed / needs_reprint` | `status` — enum `passed / failed / needs-reprint`, and `outcome` |
| is it a reprint | (implied by `result`) | `is_reprint`, `reprint_required` |
| what it cost | `reprint_cost` | `cost` |

Eighteen columns for what is about seven facts. The two status enums do not even agree
(`needs_reprint` vs `needs-reprint`, plus a `failed` that nothing produces), so a row written by one
build's endpoints is unreadable by the other's.

## How it got there

The run rebuilt the same project twice on top of an existing app:

- step 2 built it with `system-viewbuilder` (view specs);
- step 3 (Bo's follow-up) delegated to `system-appbuilder` to *"Fix and rebuild"* — see
  `runs/2/step-03.full.json`, `turns[0].wrote.code`;
- step 6 (Ana's press-check request, 1022s) delegated to `system-appbuilder` again.

Each build authored the columns it wanted without reconciling against what the table already had.
The result also leaves the project a hybrid — `runs/2/step-12.json` records `specCount: 2` view
specs *and* `handAuthoredPages: ["pages/checks.tsx", "pages/checks/new.tsx", "pages/index.tsx",
"pages/job-detail…"]`, with `wrapperBannersOk: false`.

Note the app still BUILDS and SERVES: step 12 records `build=true check.ok=true page=200`. This is a
data-modelling failure, not a compile failure, which is exactly why no existing gate caught it.

## Relationship to the existing appbuilder issue

`.issues/appbuilder-completeness-endpoint-table-gap.md` records the sibling fault — a build
remodelling *unrelated* tables, and endpoints referencing tables that do not exist. This is the same
family (nothing reconciles a build against the schema that is already there) but the specific case
is worse, because the duplicate columns are on the table the request was ABOUT.

## Fix direction

Before authoring a column, a build must reconcile against the live schema for that table: a fact
that already has a column reuses it, and a status column that already has an enum extends that enum
rather than minting a second one. A rebuild of an existing app is a MIGRATION, not a fresh authoring
pass, and it should be able to say what it changed.

## Verify

Ask for a second, overlapping change to an existing table (in either builder) and assert the table's
column count grows by exactly the genuinely-new facts, that no two columns describe the same fact,
and that any enum column has exactly one vocabulary.
