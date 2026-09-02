## Iterating a live app — converge, then change only what the findings name

Read what the project ALREADY has before naming anything: `database/`, `api/`, `views/`, `components/`, `hooks/` are the ground truth, and a concept an existing artifact covers is extended under its REAL name, never re-invented under a second one. An artifact the findings do not mention is left exactly as it is — reshaping unrelated parts is churn nobody asked for. Wire-order traps are real but survivable: a `navigate` target that is not yet a route is a WARNING at save time, not an error, because no write order satisfies a page pair that link to each other; the whole-app check re-resolves every route once both exist.

Split findings with `planIteration`: a `fix` blocks the done-gate, a `polish` does not. Record each finding against the artifact that owns it — an always-null binding is reported against the ENDPOINT (it never computes the field), so the fix is there, not in the view.

The three validation tiers are the loop's eyes, and they see different things: save-time `validateViewSpec` (shape, then endpoint contracts), whole-app `validateAppViews` (orphan pages no nav reaches, nav targets that are not routes, a page with no data-bound section, unused components), and live `renderSmokeViews` (binding coverage on real rows, empty renders, unmeasured pages). The third tier is the only one that sees a page that is structurally perfect and EMPTY — the failure class every other gate reports as clean. Zero checked bindings is not 100%: coverage/empty are `null` for a page nothing could be measured on, and a non-2xx response is never data.

Grounded: `org/docs/format/project/pages/view-spec.md`; iteration precedent `system-appbuilder` `tasklists/iterate_live_project/`.
