# Delegation between agents

Delegation runs a **child agent** as a programmatic sub-agent of the caller: the caller's turn ends, the child runs its own headless turn loop under a stripped capability profile, and its result is bound back into the caller's scope. This page covers the runtime mechanics — the `delegate` global's yield, the unified `canDelegateTo` policy and its enforcement + denial message, what a headless/delegated run actually does, and the host-driven `defaultAction` fast path that bypasses the model-facing gate.

For the authoring surface see [`../runtime-globals/delegation.md`](../runtime-globals/delegation.md) (the globals an agent calls) and [`../format/space/agents/delegation.md`](../format/space/agents/delegation.md) (the `canDelegateTo` frontmatter sub-spec). For the turn loop the child runs, see [`./turn-loop.md`](./turn-loop.md).

---

## `delegate(packageName, agentName, action?, opts?)`

`delegate` is a **value-yielding** global: calling it constructs a `delegate` `YieldRequest`, pushes it onto the VM's pending queue, ends the turn, and the host binds the resolved value back for the next turn (`sdk/org/libs/core/src/globals/delegate.ts:40-48`). The child does the work; the caller sees only the returned value.

```ts
declare function delegate(packageName: string, agentName: string, opts?: DelegateOpts): Promise<any>;
declare function delegate(packageName: string, agentName: string, action?: string, opts?: DelegateOpts): Promise<any>;
```
(`sdk/org/libs/core/src/typecheck/library-dts.ts:26-27`, `DELEGATE_DTS`)

- **`action` is optional.** With an action id the child runs that action (its tasklist, if the action declares one); without one the child runs model-driven and sees its own actions/tasklists in its system prompt (`sdk/org/libs/core/src/globals/delegate.ts:13-21`).
- **Ergonomic overload.** `delegate(pkg, agent, opts)` is accepted: an object in the `action` slot is re-read as `opts`, with no action (`sdk/org/libs/core/src/globals/delegate.ts:33-40`).
- **`DelegateOpts = { query?, context?, attachmentIds? }`** (`sdk/org/libs/core/src/globals/delegate.ts:3-10`; DTS twin at `sdk/org/libs/core/src/typecheck/library-dts.ts:88-94`). `attachmentIds` are upload ids the session resolves to real bytes/notes before handing them to the child — images ride as a `MediaPart`, files become an id-anchored note telling the specialist to call `readDocument(id)` (`sdk/org/libs/core/src/session/session.ts:945-960`).
- Return type is `any` by convention, so `result.field` reads without a cast.

All value-yielding globals (`fork`, `tasklist`, `delegate`) route through the one shared yield router; the `delegate` case simply unpacks `[packageName, agentName, action, delegateOpts]` and calls the context's `runDelegate` (`sdk/org/libs/core/src/eval/yield-router.ts:175-184`).

---

## The `canDelegateTo` policy — one evaluator, one gate

Delegation is governed by a single evaluated policy shape used at **both** declaration levels (agent `instruct.md` frontmatter and task frontmatter) and at **every** enforcement point. A raw `canDelegateTo` declaration is turned into a `DelegatePolicy` by `evaluateDelegatePolicy(entries, level)` (`sdk/org/libs/core/src/exec/target-match.ts:120-138`):

| Declaration | agent level | task level |
|---|---|---|
| key omitted (`undefined`) | `unrestricted` (back-compat) | `none` |
| `[]` | `none` | `none` |
| `["*"]` | `unrestricted` | `unrestricted` |
| explicit list | `allowlist` | `allowlist` |
| `registered:*` (may accompany entries) | any space registered at runtime | same |

```ts
if (entries === undefined) {
  return { mode: level === 'agent' ? 'unrestricted' : 'none', entries: [], allowRegistered: false };
}
if (entries.length === 0) return { mode: 'none', entries: [], allowRegistered: false };
if (entries.includes('*')) return { mode: 'unrestricted', entries: [], allowRegistered: false };
return {
  mode: 'allowlist',
  entries: entries.filter((e) => e !== REGISTERED_WILDCARD),
  allowRegistered: entries.includes(REGISTERED_WILDCARD),
};
```
(`sdk/org/libs/core/src/exec/target-match.ts:126-138`)

The tri-state — **omitted vs `[]` vs non-empty** — is what makes `[]` mean "no delegation" rather than "default". The loader deliberately preserves the distinction (raw strings only, `undefined` when the key is absent); see [`../format/space/agents/delegation.md`](../format/space/agents/delegation.md). The `DelegatePolicy` shape is `{ mode: 'none'|'unrestricted'|'allowlist', entries: string[], allowRegistered: boolean }` (`sdk/org/libs/core/src/exec/target-match.ts:97-106`). `REGISTERED_WILDCARD` is the literal string `'registered:*'` (`sdk/org/libs/core/src/exec/target-match.ts:87`).

### The policy is enforced twice, from the same value

**1. Injection + DTS (typecheck-time).** `policy.mode !== 'none'` becomes the `CapabilityProfile.delegate` flag, so an agent with `canDelegateTo: []` has no `delegate` global *and* no `DELEGATE_DTS` — a stray call fails **typecheck**, not at runtime. This is wired at the session (`sdk/org/libs/core/src/session/session.ts:262`, `:278`), the delegate VM (`sdk/org/libs/core/src/delegate/delegate.ts:157`), and the fork leaf (`sdk/org/libs/core/src/fork/fork.ts:243-245`). The system prompt drops its delegation section too via `omitDelegate: delegatePolicy.mode === 'none'` (`sdk/org/libs/core/src/session/session.ts:268`; `sdk/org/libs/core/src/delegate/delegate.ts:151`).

**2. Yield-time (runtime gate).** Every delegate path calls the *same* `isDelegateAllowed(policy, packageName, agentName, dynamicSpaces)` and, on refusal, throws `formatDelegateDenial(...)`:

```ts
export function isDelegateAllowed(policy, packageName, agentName, dynamicSpaces?) {
  if (policy.mode === 'none') return { allowed: false };
  if (policy.mode === 'unrestricted') return { allowed: true };
  const match = resolveTaskDelegate(policy.entries, packageName, agentName);
  if (match) return { allowed: true, allowedActions: match.allowedActions };
  if (policy.allowRegistered && matchesRegisteredSpace(packageName, dynamicSpaces)) {
    return { allowed: true }; // registered wildcard: any action
  }
  return { allowed: false };
}
```
(`sdk/org/libs/core/src/exec/target-match.ts:171-190`)

The three yield-time call sites, all consuming this one function:

| Path | Gate call | Denial throw |
|---|---|---|
| session VM (model-initiated) | `sdk/org/libs/core/src/session/session.ts:916-921` | `:919` |
| delegate VM (nested delegate) | `sdk/org/libs/core/src/delegate/delegate.ts:376-379` | `:377` |
| fork-leaf VM (task delegate) | `sdk/org/libs/core/src/fork/fork.ts:451-453` | `:452` |

### Target matching

Matching tolerates the ref grammar (`self` / `space/agent` / `npm:pkg/agent`, each with an optional `#action`; parsed by `parseDelegateRef`, `sdk/org/libs/core/src/delegate/ref.js`) plus symmetric directory-suffix tolerance — `fuzzyNameMatch` treats `"a/b/c"` and `"c"` as a match in either direction (`sdk/org/libs/core/src/exec/target-match.ts:23-26`, `refMatchesDelegateCall` `:34-51`). `registered:*` is satisfied when the package name matches a key/dir/packageName in the session-shared `dynamicSpaces` map at call time; the agent-existence check is deliberately **not** done there, so a wrong agent slug fails downstream with a precise "agent not found" instead of a misleading policy denial (`matchesRegisteredSpace`, `sdk/org/libs/core/src/exec/target-match.ts:148-167`). Spaces land in that map via `registerSpace(dir)` or the consent-gated `installSpace()`.

**Action narrowing.** An allowlist entry may carry `#action`. `resolveTaskDelegate` returns `allowedActions` — `undefined` when any match had no `#action` (all actions allowed), otherwise the union of the listed actions (`sdk/org/libs/core/src/exec/target-match.ts:57-78`). That `allowedActions` is threaded into `runDelegate`, which rejects a disallowed action id at `sdk/org/libs/core/src/delegate/delegate.ts:118-122`.

### The denial message

`formatDelegateDenial` builds an actionable, retryable message naming the allowed targets so the model can self-correct next turn (`sdk/org/libs/core/src/exec/target-match.ts:194-210`):

- `mode: 'none'` →
  `delegate("<pkg>", "<agent>") is not permitted — this agent declares no delegation targets (canDelegateTo: []).`
- allowlist miss →
  `delegate("<pkg>", "<agent>") is not permitted from this agent — allowed targets: <entries…>[, any space registered at runtime via registerSpace()]`

The `scope` word is `this agent` at agent level, `this task` at task level (`sdk/org/libs/core/src/exec/target-match.ts:200`), and `allowRegistered` appends the human-readable `"any space registered at runtime via registerSpace()"` to the list (`:206`).

### Real declaration (THING)

`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — an explicit allowlist of system specialists plus the `registered:*` wildcard, so THING can also reach anything it installs at runtime:

````md
canDelegateTo:
  - system-research/researcher
  - system-architect/architect
  - system-engineer/engineer
  - system-appbuilder/app-architect
  - system-appbuilder/automator
  - system-store/finder
  - system-vision/vision
  - system-files/dispatch
  - user-memory/memory
  - "registered:*"
````

---

## Headless / delegated runs — what a child run does

The delegate VM runs under `delegateCapabilities(canDelegate, app)` — a **programmatic sub-agent**: **no `ask`** (autonomous, driven from its query/context), **no `registerSpace`**, but a full **orchestrator** over its own `fork`/`tasklist`, and `delegate` follows the *delegated agent's own* `canDelegateTo` policy:

```ts
export function delegateCapabilities(canDelegate = true, app: AppCapabilities = {}): CapabilityProfile {
  return { kind: 'delegate', ask: false, orchestrate: true, delegate: canDelegate, registerSpace: false, setSessionMeta: false, allowWrite: true, app };
}
```
(`sdk/org/libs/core/src/exec/capability.ts:106-108`)

`runDelegate` (`sdk/org/libs/core/src/delegate/delegate.ts:91-441`) does, in order:

1. **Recursion cap.** `depth >= maxDepth` throws `Maximum delegation depth (N) exceeded at target "<pkg>/<agent>"` (`:93-98`). The session wires `depth: 0, maxDepth: 5` for a model-initiated delegate (`sdk/org/libs/core/src/session/session.ts:969-970`) and `depth: 1, maxDepth: 5` for one initiated by a task fork (`sdk/org/libs/core/src/session/session.ts:701-702`); each nested layer recurses with `depth + 1` (`sdk/org/libs/core/src/delegate/delegate.ts:284`).
2. **Resolve the target** from a `DelegateRegistry`. The session builds it from the space, its dependent spaces, **all system spaces** (always delegatable, e.g. `system-research/researcher`), and the runtime `dynamicSpaces` map (`sdk/org/libs/core/src/session/session.ts:924-940`).
3. **Enforce the delegator's action restriction** when `opts.allowedActions` is set and the requested `action` is not in it (`sdk/org/libs/core/src/delegate/delegate.ts:117-122`).
4. **Build the child's own context** — its own evaluated policy (`evaluateDelegatePolicy(agent.canDelegateTo, 'agent')`, `:143`), its own app grants, but **project-rooted at the parent's `projectRoot`** so a delegated specialist mutates the *current project's* app, not the system space it lives in (`:154-157`, `:193-220`).
5. **Attachments.** Image `MediaPart`s ride on the child's user message; file attachments contribute id-anchored `readDocument(id)` notes (`sdk/org/libs/core/src/delegate/delegate.ts:233-249`).
6. **Run the child's turn loop** with a delegate-scoped ForkEngine that inherits the parent's `budgetLimits`, `roleModels`, `forkDepth = depth + 1`, and the **shared `dynamicSpaces` map** so a `registerSpace()` inside a fork under the delegate propagates back to the parent (`:290-330`). Nested delegate() calls route through `runChildDelegate`, gated by this child's own policy (`:381-384`).
7. **Result capture.** `currentTask.resolve(value)` records the result synchronously (`currentTaskResolve` hook, `:209-212`); the action's tasklist envelope is **auto-captured** if the model forgets to resolve (`onTasklistResult`, `:361-367`; `capturableTasklists` at `:171-177`).
8. **Resolve guarantee.** If still unresolved after the turn loop, up to 2 forced resolve-only nudge turns run on a fresh `Budget({ maxEpisodes: 4 })` before returning `undefined` (`:398-430`). This mirrors the fork salvage and prevents a specialist that did the work but forgot to resolve from handing `null` back to the delegator.

> Consent-marked yields (e.g. `installSpace`) **fail closed** inside a delegate: no `requestConsent` is wired for a headless run, so the router's consent gate refuses before install (`sdk/org/libs/core/src/delegate/delegate.ts:344-351`). Store *search/inspect* and manual `emitEvent` still work (system-store itself runs as a delegate of THING).

The fork-leaf VM is even more restricted — headless (`ask: false`), non-orchestrating (`orchestrate: false`, so no nested `fork`/`tasklist`), and `delegate` only when the task's policy is non-`none` **and** the engine has a `delegateRunner` wired (`sdk/org/libs/core/src/exec/capability.ts:93-97`; gate at `sdk/org/libs/core/src/fork/fork.ts:243-245`). See [`./turn-loop.md`](./turn-loop.md) for the loop itself.

---

## The `defaultAction` host-driven fast path

An agent may declare a `defaultAction` (an action id with a tasklist). At session start, if `!noDefaultAction && agent.defaultAction` resolves to an action that has a tasklist, the session **skips the model-driven turn loop entirely** and runs that action through the reliable delegate path — the tasklist DAG orchestrates deterministically and can't be truncated by a weak model (`sdk/org/libs/core/src/session/session.ts:308-317`).

```ts
const defAction = (!this.opts.noDefaultAction && agent.defaultAction)
  ? agent.actions.find((a) => a.id === agent.defaultAction && a.tasklist)
  : undefined;
if (defAction) {
  this.currentScope = runScope;
  const ctx = this.buildYieldContext(this.space);
  const initialQuery = userInputText(initialMessage);
  const built = await ctx.runDelegate(this.opts.spaceDir, resolvedSlug!, defAction.id, { query: initialQuery, context: {} });
  // …unwrap TaskEnvelope, chain a second delegate if the action returned {spaceKey, agentSlug}…
}
```
(`sdk/org/libs/core/src/session/session.ts:315-348`)

**Exempt from the model-facing `canDelegateTo` gate.** The yield-time gate fires only when `enforceDelegatePolicy` is set (`sdk/org/libs/core/src/session/session.ts:910-922`), and the fast path builds its context with the default `buildYieldContext(this.space)` — where `enforceDelegatePolicy` defaults to `false` (`sdk/org/libs/core/src/session/session.ts:870`). Both delegates in the fast path are **host policy, not model output**, so they run unchecked. That deliberately includes the *chained* delegate to the `{spaceKey, agentSlug}` coordinates a build returns (effectively a `registered:*` grant), so THING/architect build flows keep working even when the agent's own allowlist wouldn't name the freshly built space (`sdk/org/libs/core/src/session/session.ts:320-341`).

By contrast, the normal model-driven turn loop builds its yield context with `{ enforceDelegatePolicy: true }`, so model-initiated `delegate` yields **are** gated (`sdk/org/libs/core/src/session/session.ts:845-847`).

The result is a `TaskEnvelope` (`{ ok, degraded, data, … }`) since the tasklist path returns one; the fast path unwraps `envelope.data` for the structural `{spaceKey, agentSlug}` check, then `display()`s the final result (`sdk/org/libs/core/src/session/session.ts:332-343`).

---

## See also

- [`../runtime-globals/delegation.md`](../runtime-globals/delegation.md) — `delegate`/`fork`/`tasklist`/`currentTask` globals, DTS, capability gates.
- [`../format/space/agents/delegation.md`](../format/space/agents/delegation.md) — the `canDelegateTo` frontmatter sub-spec (omitted-vs-empty, loader warning, worked example).
- [`./turn-loop.md`](./turn-loop.md) — the turn loop each delegated/forked child runs.
- [`./README.md`](./README.md) — runtime overview.
