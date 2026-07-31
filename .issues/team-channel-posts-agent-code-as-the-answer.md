# A team channel posts THING's SOURCE CODE (and its typecheck errors) as the answer

**Symptom** (scenarios/20-studio run 2 step 3, 2026-07-31): Bo asked a plain question in a thread —
*"can it also show which ones are stuck waiting on the client?"* — and what appeared in `#studio`,
attributed to THING, as a normal message, was this:

```
ERROR (attempt 3 of 3)
// // `apiCall` needs 2 args — the route name and an optional input. Let me pass undefined as the second arg.
// const listResult = await apiCall('jobs-list/GET', undefined);
// No overload matches this call.
  The last overload gave the following error.
    Argument of type '"jobs-list/GET"' is not assignable to parameter of type '"update-job-status"'.

// Still in scope from earlier successful statements (do NOT redeclare): app2, jobsAfter
// ALREADY EXECUTED (do not repeat — fix the failing statement and continue from there):
// Bo wants a "stuck waiting on client" filter/view — exactly the kind of thing the spec vocabulary
// couldn't express. …
setActivity('Rebuilding with the appbuilder — full features, no broken endpoints');
const app2 = await delegate('system-appbuilder', 'automator', 'build_live_project', { … })
```

The message has **no `blocks`** and its `kind` is `thing`, so every client renders it as THING
speaking. The turn was reported `done`, and the channel's `thing_status` terminal was `done`.

Evidence: `sdk/org/scenarios/20-studio/runs/2/data/.lmthing/.team/channels/studio.jsonl` (last
`thing` message) and `sdk/org/scenarios/20-studio/runs/2/step-03.json`.

## It happened three times in eleven turns, by TWO different mechanisms

| step | who asked | what the channel received |
|---|---|---|
| 3 | Bo — *"can it also show which ones are stuck waiting on the client?"* | the `ERROR (attempt 3 of 3)` banner + the agent's source, above |
| 6 | Ana — *"can you add somewhere to log the press checks Cai does?"* | `job-status jobs-get jobs-list press-checks-create press-checks-list statuses {"d…` — a raw dump of route names, after a 17-minute build |
| 9 | Rita — *"can you mark the Trindade job as invoiced?"* | `jobs press_checks` — the two table names |

Steps 6 and 9 are a DIFFERENT mechanism from step 3 and are not fixed by the change below: there the
model called `display(someRawArray)` as the last thing it did, so `renderResult` was handed a real
descriptor-less value and correctly stringified it. `display()` of a raw value is legitimate in
`/chat`, where it renders as a data blob beside the conversation; in a channel it IS the reply, and
the member gets a word salad. Both mechanisms need answers:

- **step 3** — stop falling back to the history (below);
- **steps 6 and 9** — a channel turn that ends having displayed only raw data has not answered the
  person. The anti-silent guard (`visibleToUser: true`) does not catch it, because something WAS
  displayed. It needs to be a nudge about answering, not about displaying.

## Cause of the step-3 form — the fix landed on `runHeadless` but not on `runHeadlessThreaded`

`sdk/org/libs/cli/src/server/session-manager.ts`:

- `runHeadless` at **:1909** carries the fix and the reasoning in a comment: *"ONLY what the agent
  displayed. There is deliberately no fallback to the last history entry: in this runtime the model
  does not answer in prose, it WRITES TYPESCRIPT, so that entry is the turn's source code."*
- `runHeadlessThreaded` at **:2196-2200** still has exactly the fallback that comment forbids:

```ts
const lastDisplay = displays.length ? displays[displays.length - 1] : undefined;
let result: unknown = lastDisplay;
if (result === undefined && typeof session.getHistory === 'function') {
  const history = session.getHistory();
  result = history.length ? history[history.length - 1]?.content : undefined;   // ← :2199
}
```

`runHeadlessThreaded` is the path **every team channel turn takes**
(`routes/team-channels.ts#runThingReply`). So when a channel turn displays nothing — which is
exactly what happens when it dies on an unrecovered typecheck error — the channel posts the agent's
last statement, comments and error banner included.

`renderResult` (`routes/team-channels.ts:961`) cannot save it: it is handed a string that is not a
descriptor, so it correctly stores it as prose. The bad value is chosen upstream.

## Two things to fix, not one

1. ~~**The fallback** (`:2196-2200`)~~ — **FIXED 2026-07-31 (`1c3ef2a1`).** Deleted, exactly as
   `runHeadless` did. `undefined` is the
   honest result for "it displayed nothing", and `renderResult` already has the right answer for
   that case: *"THING finished without posting an answer."*
2. **`ok: true` for a turn that ended in an unrecovered error.** The turn loop gave up after
   `attempt 3 of 3`, yet `runHeadlessThreaded` returned `{ ok: true }` (it only reports `ok:false`
   when it *throws*), so `runThingReply` took the success branch: `kind:'thing'`, `thing_status:
   done`. A turn whose last statement failed its final retry is not a success, and the channel
   should say so — `kind:'system'`, status `error`, and a sentence a member can act on.

Note the anti-silent guard (`visibleToUser: true`) is ON for channel turns and did not prevent this:
it nudges a turn that displayed nothing, but the nudge is not a guarantee, and the fallback fires
precisely when the nudge failed.

## Cost to the run

Three of the run's eleven turns delivered nothing a member could read, including both of the two
longest builds (509s and 1022s). Step 3 is 20-studio's load-bearing beat (a different member replying in a thread with no `@thing`).
The *addressing* worked — Bo's un-`@`ed reply started a turn, and it demonstrably had Ana's context
(the code reasons about *"Ana's earlier 'actually runs on the phone' concern"*). What the team
actually received was a wall of TypeScript, so the beat is half-proven and unscoreable on its own
terms: 509 seconds of work, no answer.

## Verify a fix

Force a channel turn to fail its last retry (or to display nothing) and assert the posted message
is the "finished without posting an answer" sentence as a `system` message with
`thing_status: error` — never a string containing `setActivity(`, `await delegate(` or
`ERROR (attempt`.

## Also folded in here: the memory delegate's raw listing was prepended to a real answer

Step 4's reply in `#press` opened with the `user-memory/memory` delegate's raw output before getting
to the actual answer:

```
All remembered facts
3 facts found
response-style: Prefers answers in bullet points with sources.
answer-format: bullet-points-with-sources
answer-format-preference: Prefers answers in bullet points with sources.

I've checked the #press channel history and our project memory, …
```

THING's instruct says the opposite for a delegate result — *"Read `auto` yourself, then tell them
what they can now open, in a sentence. Never dump it."* This is the same failure class as the two
above (a channel receiving working material instead of an answer) arriving by a third route, which
is why it lives here rather than in its own file.

Worth noting separately: the three "facts" are three near-duplicate spellings of one preference,
which is a smell in whatever wrote them.

## Why all of this matters more in a channel than in `/chat`

In `/chat` an ugly turn is seen by the one person who caused it and scrolls away. A channel is
**shared and permanent**: read by colleagues who did not ask, scrolled back through later, and
quoted by notifications. Every one of these was stamped with `mentions`, so it went out as a push.

## New evidence, and the seam that would fix the `display(rawValue)` half

`20-studio` run 4 step 2 (2026-07-31). After **968 seconds** of successful work — the build routed
correctly to `system-viewbuilder`, produced 6 specs, `native.status: 200` — what the channel showed
Ana was a directory listing:

```
Existing Project Files database/*.json: jobs.json pages/*.view.json: _shell.view.json,
components, create-job.tsx, create-job.view.json, index.tsx, index.view.json, job
api/**/*.ts: jobs, jobs-create, jobs-list hooks/*.ts: (none) events/*.ts: (none)
```

So this half survives every fix so far, and it is now costing the single most important reply in the
scenario rather than an incidental one.

### Where it can be gated after all

I previously wrote this off as "cannot be gated on content". That was wrong, and the seam is the
**anti-silent guard**, which already exists and already does the right thing for the neighbouring
case:

- `libs/core/src/session/session.ts:873` — `onDisplay: (value) => { this.displayedThisTurn = true; }`
- `libs/core/src/session/session.ts:319` — `hadVisibleOutput: () => this.displayedThisTurn`
- `libs/core/src/eval/turn-loop.ts:455` — the guard fires when a turn did work and showed nothing.

`displayedThisTurn` means *"`display()` was called"*, not *"a person can read what came out"*. A turn
whose only display is a raw array, an object or a file listing therefore satisfies a guard that
exists precisely to catch turns that told the user nothing.

Narrowing it to "the last display is a JSX descriptor or non-trivial prose" would route this case
into the machinery that already handles it.

**The risk that must be handled, not ignored:** the existing guard re-prompts once and then **fails
loud**. Turning a `/chat` turn that ends on `display(someTable)` — legal today, and rendered as a
data blob beside the conversation — into an error would be a worse regression than the bug. So the
two cases have to be distinguished: *displayed nothing* keeps failing loud; *displayed only data*
gets the nudge and then accepts what it gets.

**Not done yet, deliberately.** The scenario runner spawns `lmthing serve` from TS source and
`20-studio` has a `restart_pod` step, so an edit to `libs/core` mid-run would be picked up by that
restart and invalidate the run in flight.

## The specimen that corrects the diagnosis: `display()` is being used as a DEBUG PRINT

`22-crossfire` run 2 step 3 (2026-07-31), `#office`. Rae asked a plain business question — *"can you
put the lift-out fee on there as its own thing? I keep having to work it out again at invoicing and
it is never the same twice"*. The **entire** message the channel received:

```
Current project state
The project has these tables: ["boats","work_items"]
Pages: {"ok":true,"entries":["_layout.tsx","boats","index.tsx"]}
API routes: {"ok":true,"entries":["boats-add","boats-detail","boats-list","work-items-add", …]}
```

The agent's own source for that turn (`runs/2/step-03.full.json`, `turns[rae].wrote.code`) is the
whole story, comment included:

```ts
// Let me inspect the existing project tables and pages to understand what we have.
display(
  <Stack gap={2}>
    <Heading level={2}>Current project state</Heading>
    <Paragraph>The project has these tables: {JSON.stringify(tables)}</Paragraph>
    <Paragraph>Pages: {JSON.stringify(pages)}</Paragraph>
    <Paragraph>API routes: {JSON.stringify(api)}</Paragraph>
  </Stack>
);
```

That is the **complete** turn. Status `done`, `ok: true`, `globals: ["display","teamContext"]`.

So the framing above — "displayed only raw data" — was too kind, and a content classifier aimed at
it would be aimed at the wrong thing. The displayed value here is a proper JSX descriptor with
headings and prose. What is wrong is **why it was called**: the model reached for `display()` to
*look at values itself*, mid-orientation, and the turn ended on that statement.

Two false beliefs are visible in that one comment:

1. **That `display()` is how it inspects.** It is not — the eval loop already feeds every binding's
   value back in the VARIABLES block on the next cycle, so `tables`, `pages` and `api` were coming
   back to it for free. `display()` was pure loss.
2. **That a display is cheap.** In `/chat` a stray data blob is noise beside the conversation. In a
   channel the last display **is** the message: it went to `#office` under THING's name, stamped with
   `mentions`, and pushed to phones.

And the anti-silent guard *rewarded* it — `displayedThisTurn` became true, so a turn that answered
nobody reported `done`.

### What this implies for the fix — and why the cheap half is already dead

My first reading was that the prompt half was now load-bearing and cheap. **That is wrong, and it
matters, because it is the fix everyone reaches for first.** `instruct.md:112-125` already forbids
this exact turn, by name, with these examples:

> *"Calling an introspection primitive — `db.tables()`, `listProjectDir()`, a listing of the app's
> own endpoint routes, a `db.query()` you haven't finished reasoning over — and `display()`-ing that
> raw result as if it were the answer. A table list, a directory listing, or an endpoint-name list is
> a MEANS to find the real name to act on next, never the finished reply: it means nothing to someone
> who didn't just look it up."*

Rae's turn is that paragraph, acted out: `db.tables()`, `listProjectDir('pages')`,
`listProjectDir('api')`, displayed, stop. The instruction is already as specific as prose can get.
**Writing more prose about it will not fix it.** The guard has to be mechanical.

What the instruct does give us is a precise, non-fragile rule to mechanise, because it names the
primitives. A display is **orientation, not an answer**, when its text is nothing but same-turn
introspection results plus labels:

1. Record each introspection call's return value for the current turn (`db.tables`,
   `listProjectDir`, `listProjectFiles`, route listings — the set the instruct already enumerates).
2. On display, take the descriptor's flattened text and strip every substring equal to the JSON
   serialization of one of those recorded values.
3. If what remains has no sentence in it — Rae's residue is *"Current project state The project has
   these tables: Pages: API routes:"* — the turn has shown working material, not an answer.

That is a comparison against values the runtime already holds, not a content heuristic, so an answer
that legitimately quotes a table list alongside real prose keeps its prose and passes.

Wire it as a second signal beside `hadVisibleOutput` — call it `hadReadableOutput` — consumed by the
same guard at `turn-loop.ts:455`. Crucially the two branches must stay distinct:

- **displayed nothing** — unchanged: one nudge, then fail loud.
- **displayed only working material** — one nudge (*"that is what you used to find the answer; now
  answer the person"*), then **accept whatever comes back**. Never fail loud here: a `/chat` turn
  ending on `display(someTable)` is legal today and must stay legal.

### Frequency in this run

Three of the six THING messages in `22-crossfire` run 2 were working material rather than an answer,
each by a different route — the memory delegate's raw listing prepended to a good answer (`#yard`
turn 1), ~1800 characters of generated TypeScript as the reply to *"go on then"* (`#yard` turn 2,
`display()` of the automator's return value), and this one. All three: `status: done`, `ok: true`.

---

## Two more shapes of the same leak, both post-split (run 904, 2026-07-31)

The rule this violates is ALWAYS ON — it is in THING's instruct body, not behind a knowledge load,
and the prompt-split guard `libs/core/src/spaces/thing-prompt-split.test.ts` asserts it against
`instruct.md` alone precisely so it cannot drift behind a load:

> **Everything you say here is permanent, shared, and read by people who did not ask.** Nothing
> internal ever reaches it — not a compiler error, not the code you wrote, not a retry transcript,
> not another agent's report. **A failure is one sentence in plain words.**

It leaked twice anyway, in two shapes the original report does not cover:

- **step 3** — the reply's FIRST line is a writer rejection, verbatim:
  `Write error: page route "index.view.json" has an invalid path segment "index.view.json"`.
  (Underneath it is a real bug: the model passed a FILENAME where `writeProjectView` wants a ROUTE.
  The writer was right to refuse; what reached the channel was its refusal.)
- **step 6** — the reply opens `Build Result — Degraded ... Press-checks table & page exist, but jobs
  APIs are broken. The pipeline built ...`. Nobody in `#studio` has a word for *pipeline*,
  *degraded*, or an *API*, and the sentence reads as the thing being broken.

**Not a regression, and that is the point.** Across every run of this scenario: run 2 leaked the same
pipeline+API vocabulary at step 3, run 4 leaked pipeline vocabulary at step 2, run 3 was clean, run
904 leaked at steps 3 and 6. So it is stochastic at roughly 2-in-3 and it survived a prompt in which
the rule is unconditional and permanently in context.

**What that rules out.** "Say it more loudly, or higher up the prompt" is already spent — the rule is
always-on, first in the team section, and phrased as an absolute. The remaining fix is structural,
and there is an obvious seam: a team reply goes out through `teamPost`/the channel reply path, which
is host code. A **host-side scrub on the outbound team message** — reject or strip a reply whose text
carries a compiler/writer error signature (`Write error:`, `Cannot find name`, `TS####`,
`ERROR (attempt N of M)`) and ask the model for one plain sentence instead — enforces what the prose
cannot. That is the same move as `writeProjectPage` refusing a destructive overwrite.
