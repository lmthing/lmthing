# `loadKnowledge` spends a model TURN to read a local file — and re-spends it for the same file

**Found:** 2026-07-31, while splitting THING and both builders' `instruct.md` into an always-on body
plus `loadKnowledge` aspects (sdk/org `38c3df1f`, `aeb31883`, `ce36bf98`).
**Severity: medium.** Nothing is wrong; everything is slower and more timid than it needs to be, and
the cost shapes the prompts around it.

## What it costs today

`loadKnowledge` is a **value-yielding** global (`sdk/org/libs/core/src/globals/load-knowledge.ts:169`,
`kind: 'loadKnowledge'`). A yield suspends the VM, aborts the model stream, resolves host-side, and
the value comes back in the NEXT turn's `VARIABLES` block. So one aspect = one model round-trip.

What is actually being fetched is `readFile` off local disk
(`load-knowledge.ts#loadKnowledgeFileFromDirs`). No network, no model, no user. The value cannot
depend on anything the model does not already know — it is a static markdown file shipped in the
image.

**The same codebase already has the cheap version of exactly this.** `readProjectFile(path)` and
`listProjectDir(dir)` are SYNCHRONOUS injected globals returning `{ ok, content }` / `{ ok, entries }`
with no yield and no turn (`sdk/org/libs/core/src/exec/app-globals.ts:137-138`, injected at `:285-286`).
They read project files off the same disk, in the same VM, for the same kind of caller. There is no
principled difference between "read `pages/index.tsx` from the project" and "read
`knowledge/playbooks/paths/application.md` from the space" — one is free and one costs a turn.

## Nothing memoizes, at any level

There is no cache in `load-knowledge.ts` (the one `cache`-adjacent comment there is about
`mergeSystemInto`, not memoization). Measured on `scenarios/20-studio/runs/904`, a single run
re-read the SAME static file repeatedly:

| path | times loaded in one run |
|---|---|
| `playbooks/team/conduct` | 4 |
| `app_building/authoring/growing-an-app` | 4 |
| `app_building/authoring/pages-and-components` | 4 |
| `playbooks/team/workflows` | 2 |
| `playbooks/building/grow-project` | 2 |

(Counted from `sessions.log`, halving for the log's double-print of every statement.) Some of those
recurrences cross VM boundaries — a delegate gets a fresh VM — so a VM-local memo would not catch
them all; the file contents are immutable for the life of the pod, so the memo wants to live at pod
or session scope, keyed on `(baseDirs, path)`.

## Why it matters beyond the turns

The turn cost is not just latency — **it is visible in the prompts, because it had to be.** Every
split agent's body now argues about whether an aspect is worth a turn ("a load costs one turn and
nothing else — cheap against any build, install or repair"), and the `# Knowledge` menu had to be
rewritten so every entry opens with `LOAD WHEN …` so the model can decide *before* spending one.

And the model hedges against the cost in the way you would expect. Live, `06-tanzania` run 55: on its
**opening statement**, before it knew what the request needed, THING loaded three aspects at once —
`attachments/read-to-orient`, `attachments/seeding-a-build`, `paths/application` — because a second
load later would cost a second turn. That is speculative front-loading: it pays for detail it may not
use, to avoid paying again. A free load removes the incentive entirely.

Batching helps and is already in place (an array per aspect, or `Promise.all`, resolves in ONE turn —
verified in run 55's `[variables] attRead, attBuild, appPath`). But batching turns N into 1; it never
turns it into 0, and it cannot help the second load two turns later.

## Worth considering, in ascending cost

1. **Memoize per pod/session**, keyed on `(baseDirs, pathParts)`. Smallest change, no semantics
   moved, kills every repeat above. A shipped knowledge file does not change under a running pod;
   if that ever stops being true, invalidate on mtime.
2. **Resolve without a turn.** The value needs no model input and is on local disk, so the yield is
   buying nothing. Two shapes worth investigating:
   - a **synchronous** global, exactly like `readProjectFile` — the precedent is in the same file;
   - or keep the `Promise` signature but settle it immediately host-side, IF the eval loop can drain
     a microtask inside one statement. **This needs checking before it is promised** — the runtime's
     bridged-promise handling is subtle (`org/docs/runtime/README.md` on disposal-on-settle), and I
     have not verified that an `await` can resolve without a yield in this architecture.

   Either shape is **prompt-compatible**: `await` on a non-thenable is a no-op in JS, so every
   shipped prompt, every synthesized specialist's `answer` task, and every `await loadKnowledge(…)`
   in `libs/core/system-spaces/**` keeps working untouched. The DTS can keep saying `Promise<any>`.
3. **Then simplify the prompts the cost forced.** If a load is free, "is this worth a turn?" stops
   being a question an agent has to answer: the `LOAD WHEN` menu becomes a plain index, the
   batching advice becomes unnecessary, and the ratchet on the always-on body gets easier to hold
   because moving prose behind a load costs the agent nothing. Do this only after (2) actually
   lands — the current prompts are correct for the current cost.

## Verify

- A repeat load inside one run spends no second turn: re-run
  `node scenarios/run-team-scenario.mjs 20-studio --through 7` and confirm each distinct path
  appears once per VM in the `[variables]` blocks, not once per call site.
- Turn count for an opening statement that loads three aspects drops by one (run 55 is the baseline).
- `pnpm test libs/core/src/globals/load-knowledge.test.ts` still passes — including
  `resolves an array-per-aspect call to results in the SAME order` and the multi-dir fallback tests,
  which pin the semantics any optimization must preserve.

## Related

- `sdk/org/libs/core/src/spaces/agent-prompt-split.test.ts` — the guards that make the split safe;
  the ratchet test's premise is that always-on prose is expensive and a load is not free.
- `org/docs/system-spaces/README.md` §8.1 — the split pattern and why the menu is free but the
  detail is not. That section needs a revision if (2) lands.
