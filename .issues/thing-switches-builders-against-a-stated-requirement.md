# THING switched builders on its own judgement, against the user's stated requirement

**Found:** 2026-07-31, `20-studio` run 2 step 3 (`sdk/org/scenarios/20-studio/runs/2/`).
**Severity: high.** It silently discards a hard requirement the user stated in their own words, and
the result cannot be undone by the next turn — the app is rebuilt in the other medium.

## What happened

Step 2: Ana asked for something that "has to actually run on the phone itself, not a website
squeezed into an app". THING routed correctly to `system-viewbuilder`, which produced two view specs
and an app that `GET /api/apps/:id/views` serves natively (`wouldRenderNatively: true`).

Step 3: Bo, in the same thread, asked "can it also show which ones are stuck waiting on the client?"
THING **rebuilt the app with `system-appbuilder`**. Both builders appear in that one turn's
delegates:

```
["user-memory/memory",
 "system-viewbuilder/automator#build_live_project",
 "system-appbuilder/automator#build_live_project"]
```

Its own reasoning, recovered verbatim from the turn's source:

```js
// Bo wants a "stuck waiting on client" filter/view — exactly the kind of thing the spec vocabulary
// couldn't express. Combined with Ana's earlier "actually runs on the phone" concern and the
// existing bugs, the appbuilder is the right call.
setActivity('Rebuilding with the appbuilder — full features, no broken endpoints');
const app2 = await delegate('system-appbuilder', 'automator', 'build_live_project', { … });
```

Read that second sentence again: it cites Ana's phone requirement as *support* for choosing the
builder whose output is a browser bundle in a WebView — the one thing that requirement rules out.

## Why it is a defect and not a judgement call

`libs/core/system-spaces/user-thing/agents/thing/instruct.md` is explicit in both directions:

- *"Do not switch builders because an app 'sounds simple', because a phone was mentioned in passing,
  **or on your own judgement**."*
- The viewbuilder's honest-gap mechanism is `cannotExpress`: *"If it reports `cannotExpress` entries,
  TELL the user which part of which page the spec vocabulary could not express and why … Never
  quietly drop it."*

THING pre-empted that mechanism. It decided the vocabulary could not express a filter **without
asking the viewbuilder**, and switched. Whether a "waiting on client" view is expressible is
`system-viewbuilder`'s judgement to report, not THING's to predict — and the spec language has both
`list` filtering and computed endpoint fields, so the prediction is very likely wrong as well.

## The three consequences

1. **The user's requirement is silently void.** Ana asked for something that runs on the phone; the
   app is now partly appbuilder output, which is WebView-bound forever.
2. **The app is a hybrid.** Spec pages and hand-authored TSX in one project. The zero-WebView
   guarantee is a property of the whole app, so one appbuilder page ends it.
3. **Nobody is told.** Bo's reply did not say the medium changed, and Ana — who set the requirement
   — was not in that thread at all.

## Missing guard

A capability profile is the runtime's real enforcement (`views:write` vs `pages:write` exist exactly
to keep these two media apart), but THING holds neither — it delegates, and each builder holds its
own. So there is nothing between THING's judgement and a rebuild in the wrong medium.

Worth considering, in ascending cost:

- THING asks before switching builders on an existing app, as it already must when it cannot tell
  which builder a *new* request wants.
- The routing rule gains an explicit clause: **an existing app keeps its builder**; a change of
  medium is a decision for the person who stated the requirement, not for the person asking for the
  next feature.
- `build_live_project` on a project that already has `*.view.json` specs refuses in the appbuilder
  and says why, making it structural rather than advisory.

## Repro

```bash
cd sdk/org
node scenarios/run-team-scenario.mjs 20-studio --through 3
```

Fails when step 3's delegates contain `system-appbuilder` for a project whose `pages/` holds
`*.view.json`. Note this is a stochastic runtime — verify a fix over N runs, not one.

## Related

- `.issues/thing-builds-on-the-offer-turn.md` — the other restraint failure from the same scenario.
- `design/appbuilder-viewspec-plan.md` — the owner decision that routing is explicit opt-in and
  `system-appbuilder` is frozen.

---

## Still reproduces with the prose clause IN PLACE — it needs the structural fix (run 904, 2026-07-31)

The second bullet above ("the routing rule gains an explicit clause: **an existing app keeps its
builder**") has since been implemented, twice over. It is in THING's ALWAYS-ON instruct body —

> **And an app that already EXISTS keeps the builder that made it** — look at `listProjectDir('pages')`
> and match what is there (`*.view.json` specs are the spec builder's, `*.tsx` pages the default
> one's); switching medium halfway reverses a requirement somebody stated, so put it to them rather
> than settling it yourself.

— and the full rationale, including the two traps ("never reason from the requirement to the switch",
"never predict on a builder's behalf that it cannot express something"), is in
`system-appbuilder`-adjacent knowledge at `user-thing/knowledge/playbooks/building/spec-app.md`.

**`20-studio` run 904 mixed the media anyway**, and the run log shows THING *loaded* `spec-app` on
the very turn it did so. The resulting `pages/` holds both media side by side:

```
components  index.tsx  index.view.json  jobs  _shell.view.json
```

Both builders appear in the run's step-01..03 delegates
(`system-appbuilder/automator#build_live_project` AND `system-viewbuilder/automator#build_live_project`).

This is not new behaviour and not a regression — checking every prior run of the scenario, run 2
produced `index.tsx` + `index.view.json` + `job-detail` in BOTH media, and run 4 produced `create-job`
in both. Only run 3 stayed single-medium. But it does settle something the issue left open: **the
prose clause is not sufficient, and reading it on the turn does not make it hold.** What is left is
the third bullet — refuse it in the writer:

> `build_live_project` on a project that already has `*.view.json` specs refuses in the appbuilder
> and says why, making it structural rather than advisory.

That is the same shape as every other rule in this system that actually holds: the medium is already
separated BY CAPABILITY (`views:write` vs `pages:write`), so the check belongs where the capability
does — a `writeProjectPage` into a project whose `pages/` holds `*.view.json` (and the reverse)
should return `{ ok:false }` naming the medium already in use, exactly as `writeProjectPage` already
refuses a page that would delete sections the user has.

**Repro (post-split):** `node scenarios/run-team-scenario.mjs 20-studio --through 7`, then
`ls <run>/data/.lmthing/studio-jobs/pages/` — a mix of `*.tsx` and `*.view.json` is the failure.
Stochastic: 3 of 4 runs to date.

## Not the same bug as the `spaceRef` mis-resolution (sdk/org 3e8e49a8)

A separate defect found the same day made every `system-*` **spaceRef** resolve to a directory that
does not exist, so the agent slug fell through to the flattened merge of all system spaces — where
the viewbuilder, being listed later, won `automator`. A session bound to `system-appbuilder/automator`
therefore ran the VIEWBUILDER and wrote `.view.json` specs.

That is NOT what is happening here, and the distinction matters for anyone picking this up:

- the spaceRef bug affects space-**bound** sessions only (the harness's `space_session`, a chat bound
  to `<space>/<agent>`). The **delegate** path was unaffected — `DelegateRegistry#matchesSpace` falls
  back to `space.dir.endsWith('/' + name)`, which matches the real space dir;
- THING reaches both builders through `delegate()`. In run 904 BOTH appear in the recorded delegates,
  and the project ends up holding `index.tsx` AND `index.view.json`. That is two deliberate
  delegations to two different builders, not one delegation silently resolving to the wrong space.

So the spaceRef fix does not close this issue, and a rerun after it will still reproduce. It does mean
any OLDER evidence gathered through `space_session` (e.g. `13-plant-care`, which drives
`system-viewbuilder/automator` directly) needs re-reading before it is cited about which builder ran.
