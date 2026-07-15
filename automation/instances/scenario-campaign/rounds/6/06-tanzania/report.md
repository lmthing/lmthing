# 06-tanzania — round 6 report

## Verdict

**Step 01 initially failed; the L1 prompt fix verified on a fresh replay.**

The original diagnosis that the voice memo was not transcribed was incorrect. Audio transcription is an upload-time operation, not an agent `delegate`/yield. The clean reproduction proved that `voice-memo.mp3` had a persisted Whisper transcript and that the transcript had already been appended to THING's input. The actual first failure was that THING treated the `system-files/dispatch` result as an object, although every files delegate resolves a plain string. It stopped with the user-visible reply `filesAnswer is a string`, without making the required offer.

Verification replay `attempt-3` ran from an empty runtime root through step 01. It passed all expectations and then stopped, as required. No product changes were committed.

## Attribution and changes

### `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`

- **Rung:** L1 — prompt.
- **Why this rung:** THING selected the correct primitives: image vision delegation, files dispatcher delegation, and audio transcript use. No primitive failed and no capability was absent. The dispatcher and vision agents explicitly resolve their findings with `currentTask.resolve(<plain string>)`; THING's attachment example did not make that result shape explicit. THING then inspected `filesAnswer.datasets`, discovered the value was a string, and rendered that implementation detail instead of composing the promised offer.
- **Probe / evidence of attribution:** In clean `attempt-2`, the stored upload metadata for `voice-memo.mp3` contains the complete transcript. The top-level trace comment says the memo is “transcribed above,” and later successfully uses its Emmanuel / bracelet / ranger-tip details. The trace shows the files dispatcher, reader, and sheet agents completed their delegates. The failure occurs only after that successful work, in the top-level statement `const datasets = filesAnswer.datasets;`, followed by `display(\`filesAnswer is a ${rawType}\`)`. This is a decision/interpretation failure at the orchestrator prompt layer, not an upload/transcription gap.
- **General principle:** When an agent delegates for a summary, it must know the delegated result's actual return shape and compose a user-facing answer from it immediately. It must not infer object fields that no delegate promises, inspect implementation data, or expose it to the user.
- **Before → after:** Before, the example implied that the return values should be used but did not state that they are strings. After, it says both attachment delegates resolve to plain text and explicitly prohibits inspecting them as objects; its example renders concise prose based on the two strings in the same statement.

### `sdk/org/libs/core/src/spaces/prompt-contract.test.ts`

- **Rung:** L1 regression coverage.
- **Why:** Adds a prompt-contract test requiring the user-facing attachment instructions to name delegate returns as plain text and prohibit object inspection. It locks the corrected general rule without adding a framework primitive.
- **Result:** `pnpm --dir sdk/org exec vitest run libs/core/src/spaces/prompt-contract.test.ts` passed: **12/12 tests**.

### `org/docs/system-spaces/README.md`

- **Rung:** matching documentation update for the changed system-space contract.
- **Why:** Documents that the image/files delegates return plain-text summaries and that THING composes them immediately rather than inspecting fields or rendering raw results.
- **Result:** `pnpm docs:check` passed: **118 docs, 4554 citations**.

## Evidence

### Failing clean reproduction — `attempt-2/step-01.json`

- The runner started from a fresh server and recorded no authored state: `spaces: []`, no tables, no pages, and `built: false`.
- It delegated to `system-files/dispatch`, `system-vision/vision`, then `system-files/reader` and `system-files/sheet`.
- It yielded `readDocument` for the markdown, XLSX, and PDF.
- The corresponding audio metadata at the fresh runtime path `.lmthing/uploads/8878a8c0-c4f3-42d9-a3ca-41db6f65e9f8.json` has `kind: "audio"`, `filename: "voice-memo.mp3"`, and a non-empty transcript naming Emmanuel, the bracelet payment, and the ranger tip.
- The top-level trace subsequently issued:

```ts
const datasets = filesAnswer.datasets;
```

then displayed:

```ts
display(`filesAnswer is a ${rawType}`);
```

This failed the required offer expectation despite successful attachment processing.

### Verifying fresh replay — `attempt-3/step-01.json`

- Fresh runtime/project, replayed only step 01.
- Delegates: `system-vision/vision`, `system-files/dispatch`, `system-files/reader`, and `system-files/sheet`.
- Yields include the three `readDocument` calls, proving the markdown, spreadsheet, and PDF were processed. The stored `voice-memo.mp3` metadata again has a persisted transcript.
- The user-visible offer accurately includes image details, Emmanuel, the roughly TZS 35,000 bracelets, the roughly TZS 5,000 cash ranger tip, the notes/cost/PDF material, and ends with: “Want me to put this together for you?”
- Final snapshot remains empty: no spaces, no tables, no pages, and `built: false`. The offer therefore preceded all authoring.
- Recovered delegate-level `typecheck_error` entries remained in the trace, but reader/sheet results were delivered and the complete, grounded offer landed; they were non-fatal metrics, not a failed deliverable.

## Overfitting check

A literal grep over the changed THING prompt and regression test found no new scenario identifiers, persona names, fixture names, route/table names, or scenario-specific facts in the edited hunks. The broader pre-existing prompt contains generic Zanzibar insurance examples, which were not modified by this invocation.

## Uncommitted files for review

- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`
- `sdk/org/libs/core/src/spaces/prompt-contract.test.ts`
- `org/docs/system-spaces/README.md`
- `automation/instances/scenario-campaign/rounds/6/06-tanzania/PROGRESS.md`
- `automation/instances/scenario-campaign/rounds/6/06-tanzania/attempt-2/`
- `automation/instances/scenario-campaign/rounds/6/06-tanzania/attempt-3/`
- this `report.md`
