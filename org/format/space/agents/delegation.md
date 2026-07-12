# `canDelegateTo` — delegation policy (agent frontmatter sub-spec)

`canDelegateTo` is an agent `instruct.md` frontmatter key that controls which other agents this agent's `delegate()` calls may target `sdk/org/libs/core/src/spaces/load.ts:420`. It is one of the allow-listed agent frontmatter keys (a typo'd key fails loud rather than being silently ignored) `sdk/org/libs/core/src/spaces/load.ts:461-466`. See [`frontmatter.md`](./frontmatter.md) for the full key list and [`README.md`](./README.md) for the agent directory layout.

The raw value is a list of ref strings; entries may carry an `#action` suffix or an `npm:` prefix, and parsing happens downstream in `evaluateDelegatePolicy` — the loader stores raw strings only `sdk/org/libs/core/src/spaces/load.ts:31-44`. The current key is `canDelegateTo`; the deprecated `dependencies:` key is read as a one-release fallback when `canDelegateTo` is absent `sdk/org/libs/core/src/spaces/load.ts:476-481`.

## Omitted vs empty is semantic

The loader keeps `canDelegateTo` as `undefined` when the frontmatter key is absent, distinct from an empty `[]`, so the policy evaluator can apply the level-specific default `sdk/org/libs/core/src/spaces/load.ts:445-447`. The evaluated `AgentDef.canDelegateTo` field is therefore a tri-state (`undefined` / `[]` / non-empty) `sdk/org/libs/core/src/spaces/load.ts:31-44`.

## The policy table

A raw declaration is turned into a `DelegatePolicy` by `evaluateDelegatePolicy(entries, level)`, where `level` is `'agent'` (from `instruct.md`) or `'task'` (from a tasklist step's frontmatter) `sdk/org/libs/core/src/exec/target-match.ts:121-138`.

| Value | agent level | task level |
|---|---|---|
| omitted (`undefined`) | `unrestricted` (back-compat) | `none` |
| `[]` | `none` | `none` |
| `["*"]` | `unrestricted` | `unrestricted` |
| explicit list | `allowlist` (hard, yield-time gate) | `allowlist` |
| `registered:*` | any `registerSpace()`d space — may accompany other entries | same |

- An agent that omits the key keeps its historical **unrestricted** delegate so existing user spaces don't break; a task that omits it has **no** delegate `sdk/org/libs/core/src/exec/target-match.ts:125-130`.
- `[]` → `mode: 'none'` at both levels — the `delegate` global is not injected and is absent from the ambient DTS `sdk/org/libs/core/src/exec/target-match.ts:131`, `sdk/org/libs/core/src/exec/capability.ts:56-60`.
- `["*"]` → `mode: 'unrestricted'` — injected, any target `sdk/org/libs/core/src/exec/target-match.ts:132`.
- An explicit list → `mode: 'allowlist'`; the `registered:*` entry is filtered out of `entries` and recorded separately as `allowRegistered` `sdk/org/libs/core/src/exec/target-match.ts:133-137`.

The `registered:*` wildcard grants delegation to any space registered at runtime via `registerSpace()` (present in the session's shared `dynamicSpaces` map at call time) and may appear alongside concrete entries `sdk/org/libs/core/src/exec/target-match.ts:84-87`.

## Agent-level default (unrestricted) vs task-level default (none)

The default is the only place agent and task levels diverge: an omitted declaration is `unrestricted` for an agent but `none` for a task `sdk/org/libs/core/src/exec/target-match.ts:125-130`. `sessionCapabilities` defaults `canDelegate` to `true`, derived from the session agent's policy being `mode !== 'none'` `sdk/org/libs/core/src/exec/capability.ts:83-85`. A fork-leaf task only receives `delegate` when its own `canDelegateTo` policy is non-`none` AND the engine has a `delegateRunner` wired `sdk/org/libs/core/src/fork/fork.ts:243-244`.

## Injection and DTS stay in lockstep with the gate

The `delegate` capability flag is driven at every level by `policy.mode !== 'none'`, so both VM injection and the ambient DTS track the yield-time gate; a call to a `delegate` that is not injected fails typecheck rather than throwing at runtime `sdk/org/libs/core/src/exec/capability.ts:38-45`, `sdk/org/libs/core/src/exec/capability.ts:56-60`.

## Violations throw at call time, naming the allowed targets

The yield-time gate is `isDelegateAllowed(policy, packageName, agentName, dynamicSpaces)`, consulted by every delegate path (session VM, delegate VM, fork-leaf VM) `sdk/org/libs/core/src/exec/target-match.ts:172-191`. It returns `{allowed:false}` for `mode:'none'`, `{allowed:true}` for `mode:'unrestricted'`, matches the allowlist entries via `resolveTaskDelegate` otherwise, and finally checks `matchesRegisteredSpace` when `allowRegistered` is set `sdk/org/libs/core/src/exec/target-match.ts:183-190`.

On the model-initiated (VM) delegate paths the session enforces the gate only when `enforceDelegatePolicy` is set — the host-driven `defaultAction` fast path is exempt `sdk/org/libs/core/src/session/session.ts:910-921`. A denied call throws the message built by `formatDelegateDenial`, which names the allowed targets (concrete entries plus "any space registered at runtime via registerSpace()" when applicable) so the model can self-correct on the next turn `sdk/org/libs/core/src/exec/target-match.ts:195-210`. The delegate VM path `sdk/org/libs/core/src/delegate/delegate.ts:376-379` and the fork/task path `sdk/org/libs/core/src/fork/fork.ts:451-453` throw the same denial.

An allowlist match with `#action` suffixes narrows *which* actions are permitted: `resolveTaskDelegate` returns `allowedActions` (`undefined` = any action; a bare `space/agent` entry allows every action) which composes with the narrowing inside `runDelegate` `sdk/org/libs/core/src/exec/target-match.ts:58-78`, `sdk/org/libs/core/src/session/session.ts:913-921`.

## Loader warning for a confusing `[]`

Historically the agent level was a silent no-op (`[]` still delegated unrestricted); the loader now warns only for the genuinely confusing combo — a `canDelegateTo: []` frontmatter whose `instruct.md` body actually calls `delegate()` — suggesting `["*"]` or an explicit allowlist `sdk/org/libs/core/src/spaces/load.ts:482-492`. A plain `canDelegateTo: []` on a non-delegating agent is the correct "hard none" declaration and does not warn `sdk/org/libs/core/src/spaces/load.ts:483-488`.

## Worked example

From the `app-architect` agent, which delegates to an explicit allowlist of specialist agents `.lmthing/system/spaces/system-appbuilder/agents/app-architect/instruct.md:20-25`, and the `data-modeler` agent, which declares the "hard none" `[]` `.lmthing/system/spaces/system-appbuilder/agents/data-modeler/instruct.md:10`:

```yaml
# app-architect/instruct.md — explicit allowlist (mode: 'allowlist')
canDelegateTo:
  - system-appbuilder/data-modeler
  - system-appbuilder/page-builder
  - system-appbuilder/api-author
  - system-appbuilder/automator
  - system-research/researcher

# data-modeler/instruct.md — hard none (mode: 'none'); delegate not injected
canDelegateTo: []
```

With the allowlist above, `delegate("system-appbuilder", "data-modeler")` is permitted, while a target outside the list throws the `formatDelegateDenial` message listing exactly those five entries `sdk/org/libs/core/src/exec/target-match.ts:185-209`.

## See also

- [`frontmatter.md`](./frontmatter.md) — all agent frontmatter keys and the allow-list gate
- [`README.md`](./README.md) — agent directory layout (`instruct.md`, `charter.md`, `actions`)
