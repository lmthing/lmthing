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
