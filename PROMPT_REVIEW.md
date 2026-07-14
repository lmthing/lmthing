# System-space prompt review

**Scope:** `org/docs/system-spaces/README.md` and all ten shipped spaces in
`sdk/org/libs/core/system-spaces/`.

**Method:** Reviewed agent frontmatter, charters/instructions, tasklists, relevant
knowledge contracts, function/capability availability, and the documented runtime
semantics. Findings below are prompt or prompt-to-runtime contract defects; this is
not a general code-quality review.

## Summary

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 3 |
| Medium | 5 |
| Low | 1 |

The most important issues are: THING's unrestricted project API capability, an
architect task that instructs the model to call unavailable web functions, and the
catalog appbuilder reporting success when required generated artifacts fail.

## Findings

### High — THING may invoke arbitrary project APIs without a read-only or consent boundary

- **Prompt:** `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:6-10, 554-570`
- **Contract:** `org/docs/system-spaces/README.md:147-164`

THING declares `api:call: { allow: ['*'] }` and is instructed to enumerate project
APIs and invoke the endpoint that appears to compute a requested value. The
capability allowlist is the enforcement boundary; a wildcard permits every project
endpoint, including state-changing or externally consequential routes. The prompt
does not require classifying an endpoint as read-only or obtaining confirmation
before a non-read-only call.

**Impact:** A malicious instruction in project/API metadata, ambiguous endpoint
naming, or ordinary model error can lead the user-facing orchestrator to invoke a
mutating API without user confirmation.

**Recommended direction:** Replace the wildcard with an explicitly safe query
surface. If broad API invocation is necessary, expose structural read-only metadata
and require explicit confirmation before any endpoint that is not demonstrably
read-only.

### High — Architect edit task instructs the model to call web functions withheld by task frontmatter

- **Prompt:** `sdk/org/libs/core/system-spaces/system-architect/tasklists/iterate_space/03-edit.md:41-42`
- **Contract:** `org/docs/system-spaces/README.md:74-78`

The `edit` task has no `functions:` allowlist, while tasklist semantics specify that
an absent or empty list does not inject universal functions. Nevertheless, its
instructions say to call `await webSearch(...)` and `await webFetch(...)` when
fresh research is needed.

**Impact:** The instructed path fails typechecking because these globals are absent,
preventing an iteration that genuinely requires research from completing.

**Recommended direction:** Explicitly allowlist `webSearch` and `webFetch` for this
node, or remove this recovery path and make research a separate task with its own
narrow authorization.

### High — Catalog appbuilder reports a completed app when required artifact writes fail

- **Prompt:** `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_app/07-finalize.md:15-25`
- **Related prompt:** `sdk/org/libs/core/system-spaces/system-appbuilder/agents/app-architect/instruct.md:41-45`

The goal node filters failed tables, APIs, pages, and hooks out of its output, but
sets `ok` solely from `create_project.ok`. The parent prompt consequently presents
`ok: true` as a built app even if required APIs or all pages failed to write.

**Impact:** Callers can receive a successful build result for a catalog app that is
missing its required artifacts and may not be openable or usable.

**Recommended direction:** Make final success depend on successful project creation
and every non-optional required artifact. Require at least one successful page for
a working-app result, and preserve artifact failure details in the result.

### Medium — File dispatcher promises a scan-to-vision path not supplied by reader knowledge

- **Prompt:** `sdk/org/libs/core/system-spaces/system-files/agents/dispatch/instruct.md:57-74`
- **Conflicting knowledge:** `sdk/org/libs/core/system-spaces/system-files/knowledge/documents/formats/pdf.md:12-15`

The dispatcher says a textless scan will return host-produced page-image IDs that it
must pass to the vision agent. The reader's loaded PDF contract instead says a scan
returns a no-text error and requires a future OCR path; it does not define or promise
page-image IDs.

**Impact:** The dispatcher can attempt a second delegate call with unavailable IDs,
or claim an analysis path exists when it does not.

**Recommended direction:** Align the upload resolver, `readDocument` error schema,
reader knowledge, and dispatcher prompt. Either reliably return documented page-image
IDs, or remove the recovery path and state the current OCR limitation clearly.

### Medium — File dispatcher silently drops failed delegate results

- **Prompt:** `sdk/org/libs/core/system-spaces/system-files/agents/dispatch/instruct.md:46-55, 84-85`
- **Contract:** `org/docs/runtime-globals/delegation.md:77-78, 193-205`

When document and tabular groups are processed in parallel, the recommended result is
`[docAnswer, sheetAnswer].filter(Boolean).join(...)`. Delegate failures or unresolved
delegates can therefore disappear, while the surviving result is presented as the
complete answer.

**Impact:** A mixed attachment request can produce an incomplete, unlabelled answer
with no indication that one group could not be analyzed.

**Recommended direction:** Require explicit per-group result handling, attribution,
and error reporting. Return useful successful results, but identify every group that
could not be processed instead of filtering falsy results.

### Medium — Appbuilder describes catalog-template authoring as live-project authoring

- **Prompts:**
  - `sdk/org/libs/core/system-spaces/system-appbuilder/agents/app-architect/charter.md:1-8`
  - `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_app/index.md:6-10`
- **Contract:** `org/docs/system-spaces/README.md:44-48, 121-125`

The app-architect prompt says it builds inside the user's/current project. Its
`createProject` and `writeTableSchema`/`writePage`/`writeApi` path instead creates a
store-catalog, installable application template. The `automator` is the separate
agent that writes into the live project.

**Impact:** The agent can misrepresent where artifacts are written, and callers may
select a catalog-template builder when the request requires a live-project app.

**Recommended direction:** Describe the app-architect consistently as creating a
catalog/installable template. Reserve live/current-project wording and
`writeProject*` APIs for the automator.

### Medium — Appbuilder fan-out prompts generate every API/page from index-zero design entries

- **Prompts:**
  - `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_app/04-build_api.md:19-31`
  - `sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_app/05-build_page.md:19-38`

Each API build node queries `design.tables[0]`, and each page uses
`design.endpoints[0]` and assumes `{ id, title }` rows. This conflicts with the
instruction that each fan-out node implements its own designed endpoint or page.

**Impact:** Multi-resource apps get duplicate/misleading list routes and pages that
ignore their own purpose, relationships, or fields; code may typecheck while not
matching the requested app.

**Recommended direction:** Make the design schema carry implementation-ready,
per-item contracts (selected table, fields, API name/input/output), and require each
fan-out node to use its own `item` instead of global index-zero defaults.

### Medium — Specialist build task passes an object across a declared JSON-string boundary

- **Prompt:** `sdk/org/libs/core/system-spaces/user-thing/tasklists/build_specialist/02-build.md:18-26`
- **Downstream contract:**
  - `sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/index.md:2-12`
  - `sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/02-build_field.md:22`

`build_specialist` passes `research.report` as an object in `context.research`. The
architect tasklist declares `research: string` and parses it using `JSON.parse`.
Current architect orchestration happens to stringify its `context.research`, but this
makes the direct inter-agent contract inaccurate and fragile; an already serialized
report can also be double encoded.

**Impact:** Future prompt refactors or direct callers can make research unreadable,
degrading the specialist's generated knowledge without a clear failure.

**Recommended direction:** Choose one boundary and state it everywhere. Prefer a
report object between delegates and have the architect stringify exactly once before
calling its tasklist, or serialize at every caller and accept only a JSON string.

### Medium — Engineer prompt requires `execShell` while omitting it from its advertised tool surface

- **Prompt:** `sdk/org/libs/core/system-spaces/system-engineer/agents/engineer/instruct.md:24-25, 30-40, 67-69`
- **Contract:** `org/docs/system-spaces/README.md:30, 41, 160`

The engineer repeatedly must verify code with `execShell`, but its frontmatter names
only `readFile`, `writeFile`, `editFile`, `listDir`, `glob`, and `grep`. `execShell`
is injected through `fs:scratch`, not the space's functions list, but the prompt does
not explain that distinction and its listed scratch tools omit the essential verifier.

**Impact:** Required verification is ambiguously advertised and becomes fragile if a
model interprets the frontmatter list as its entire tool surface.

**Recommended direction:** State explicitly that `fs:scratch` provides `execShell`
alongside the filesystem tools, and document the expected verification/result
handling in the prompt.

### Low — Architect finalizer does not clearly distinguish reporting registration from authority to register

- **Prompt:** `sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/08-finalize.md:12-27`

The finalizer is an `explore` task but packages output stating that registration has
succeeded. Registration presently happens in the preceding general-role node, so the
path works. However, the prompt does not explicitly say that finalization is
read-only packaging and must never attempt registration or recover a registration
failure itself.

**Impact:** The current DAG masks an authority boundary that can be violated by a
future reorder or by model-driven recovery behavior.

**Recommended direction:** State in the finalizer that only the preceding register
node has registration authority; finalization must package its result and never call
`registerSpace`.

## Reviewed without a verified prompt defect

- `system-global` — function-only universal toolkit; function signatures and documented
  behavior align.
- `system-store/finder` — catalog search/inspect, fit result shape, and no-install
  boundary align.
- `system-vision/vision` — image scope, vision-model use, and relay contract align.
- `user-memory/memory` — memory operation and resolve contract align.
- `system-research/researcher` and its `research`/`deep_research` tasklists — function
  allowlists, prelude-owned fetching, cited-result shape, and uncertainty guidance
  align.

## Cross-cutting observations

1. **Structural policy should remain the source of enforcement.** Several findings
   stem from prose promising a capability or recovery path that task frontmatter,
   knowledge, or the runtime does not provide. The docs' stated rule—enforce with
   roles, capabilities, and allowlists rather than prose—should be applied uniformly.
2. **Prompt contracts should use one serialization boundary.** Delegate/tasklist
   inputs must state whether data is an object or JSON string; a hidden conversion in
   one intermediary makes all other callers brittle.
3. **Success must represent the advertised user outcome.** A project directory,
   partial delegate result, or registration attempt is not itself a successful
   app/file-analysis/build outcome. Goal prompts should carry enough failure detail
   for the caller to report a qualified result.
