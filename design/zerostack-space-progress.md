# `system-zerostack` — an external coding agent over the data directory

Started and completed 2026-07-31. Design doc (source of truth): [`org/docs/system-spaces/zerostack.md`](../org/docs/system-spaces/zerostack.md).

**Goal.** Give LMThing agents a way to do hard software engineering against *live* generated apps —
read them, run their typechecker, open their SQLite database — by shipping the third-party
[zerostack](https://github.com/gi-dellav/zerostack) coding agent (Rust, GPL-3.0, v1.7.2) in the
compute image and running it over the LMThing data directory.

## Decisions taken with the user

| Decision | Choice |
|---|---|
| Protocol | One-shot + session resume (`-p` / `-c`), **not** ACP. Stable CLI surface, no JSON-RPC client to maintain. |
| Permissions | `--yolo`, cwd = the data root, file tools confined to it. Anything that prompts deadlocks headless. |
| Topology | **engineer is the sole caller.** THING / architect / appbuilder-automator → engineer → zerostack. |
| Model | Same provider, model and key as the engineer — spend lands on the same LiteLLM budget. |

## What landed

**Host bridge** — `sdk/org/libs/cli/src/host/zerostack-endpoint.ts` (+ `zerostack-agents.ts`)
- Loopback HTTP endpoint publishing `LMTHING_ZEROSTACK_URL`; ops `status` / `ask` / `loop` /
  `sessions` / `cancel`. Modelled on `host/browser-endpoint.ts` so the space functions are plain
  `fetch` wrappers — no new global, no capability, no DTS entry.
- One `XDG_DATA_HOME` per logical session, which is what makes `-c` deterministic.
- Generates `config.toml` (MCP off outright); writes `AGENTS.md` + `ARCHITECTURE.md` every boot.
- Started from `serve.ts`; `SessionManager.defaultModel` added as the model source.

**Space** — `sdk/org/libs/core/system-spaces/system-zerostack/`
- Agent `zerostack` (leaf, `canDelegateTo: []`), 5 functions, 2 knowledge fields:
  `zerostack/driving` (4 aspects) and `zerostack/lmthing_apps` (4 aspects — the repair skillset).
- Registered in `SYSTEM_SPACE_NAMES`.

**Wiring** — engineer gains `system-zerostack/zerostack` + a "when to escalate" section; architect
and the appbuilder automator gain `system-engineer/engineer`. THING already had the engineer.

**Image** — `devops/argocd/compute/Dockerfile` installs the pinned **full** (`--all-features`)
`-gnu` release to `/usr/local/bin/zerostack` and runs `--version` as a build gate.

**Docs** — new `org/docs/system-spaces/zerostack.md` + a row in that directory's README.
`pnpm docs:check` adds no unresolved citations; every line anchor was manually verified to point
at the claim it supports (the checker only proves bounds, not accuracy).

## Verified

- `pnpm typecheck` — 9/9 packages clean.
- `pnpm test libs/cli/src/host` — 32 passed (28 bridge tests), plus 4 delegation-gate tests green.
- `pnpm test libs/cli` — 1460+/1484. The 2-3 failures move between runs and are the concurrent
  session's: `fk-options.{ts,test.ts}` are brand-new untracked files, and
  `session-manager.spaceref` passes 4/4 in isolation with my change in place (verified by stashing
  it — the failure is order-dependent, not mine).
- **Live end-to-end**: real binary + real model through the real bridge. `status` ok; turn 1 read a
  file and applied a rule *from the generated `AGENTS.md`* ("named `handler.ts`, not
  `<METHOD>.ts`"); turn 2 resumed the same `sessionId` and remembered the context.

## Two things the live run caught that no unit test would have

1. **Three third-party MCP servers are ON by default** — Exa (`mcp.exa.ai`), Context7, grep.app.
   The Exa one opened a session with no `EXA_API_KEY` set. Inside a pod that is data egress from
   the person's entire data directory to accounts nobody configured.
2. **A missing `ARCHITECTURE.md` triggers an interactive prompt**, even under `-p`. It fails safe
   here (stdin is `ignore`, so the read EOFs) but that is the recovery working, not the question
   going away.

## Round 2 — MCP off outright, and a real architecture primer

**MCP disabled at two levels.** `mcp_servers = {}` is load-bearing: the three defaults apply only
while that key is UNSET, so an explicit empty map leaves nothing defined and a later upstream
release cannot add a fourth default underneath us. `enable-exa-mcp` / `enable-context7-mcp` /
`enable-grepapp-mcp` then refuse each by name, and `allow_all_mcp_calls = false` completes it. A
test also pins that every top-level key is emitted BEFORE the first `[table]` header — TOML is
positional, and a key written after one silently joins that table instead.

**`ARCHITECTURE.md` is now a full reference** (~22 KB), in its own module
`libs/cli/src/host/zerostack-architecture.ts`. It covers what LMThing is (per-user pods; agents
write TypeScript into a QuickJS sandbox; a project IS an application), the data directory, and the
exact shape of every format: table schemas and their fail-loud validation, `api/**/<METHOD>.ts`
routing plus the async `ctx.db` proxy, view specs (the closed 8-kind / 24-element vocabulary, the
eight binding roots, the generated `.tsx` wrapper), the older TSX medium, hooks and event
addressing, spaces (the frontmatter allow-list, all-or-nothing loading, sandboxed functions,
capabilities), what is generated, a symptom→cause table, and how to verify.

`AGENTS.md` was rewritten as the *contract* — off-limits, how to verify, how to report — with the
format detail removed, since both files load as context and must not duplicate each other.

**Re-verified live.** Asked zerostack to answer four questions from the primer alone: it got all
four right (`handler.ts` is not routed and why; a page is `.view.json`; one bad schema kills the
whole app; `types/generated.d.ts` is never hand-edited). stderr came back **empty**, where the
first run carried the Exa MCP error — MCP is genuinely silent.

## New gate worth keeping

`libs/core/src/spaces/system-delegation.test.ts` — `loadSpace` validates `functions:`,
`components:`, `knowledge:` and `actions[].tasklist` and throws on a miss, but `canDelegateTo`
points *across* spaces so nothing could check it. A typo there passed every existing gate and only
showed up as an agent quietly improvising instead of delegating. This resolves every shipped ref.

## Not done

- **Not deployed, not pod-verified.** The image change needs a build; the live run above was local
  against the real binary and the real model, not inside a pod.
- **Nothing committed.** A concurrent session in this same checkout is mid-way through merging
  `system-viewbuilder` into `system-appbuilder` (staged renames + deletions), and
  `libs/core/src/spaces/system.ts` now carries both their change and mine. Committing needs
  `git commit --only <paths>` and care over that shared file.
- **Tasklist-level wiring for the builders is agent-level only.** The automator runs its work
  inside `build_live_project` tasklist nodes, which would each need their own `canDelegateTo` to
  escalate mid-build. Left alone deliberately — that space is being actively rewritten.
