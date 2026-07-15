# 06-tanzania — round 5 report

## Verdict

**Step 01 failed on attempt 1 and is fixed and verified.** The failure was L1 (THING prompt behavior), not a scenario defect or framework gap. A fresh attempt-2 replay through step 01 passed all three assertions. Per the one-failure rule, I stopped after verification; no later steps were run.

## Failing evidence — attempt 1

Artifact: `attempt-1/step-01.json`

THING correctly reached the necessary attachment specialists:

- `system-files/dispatch`, which reached both `system-files/sheet` and `system-files/reader`;
- `system-vision/vision` for the photograph;
- the voice memo was supplied as transcript in the turn message.

It initially emitted this recovered `typecheck_error`:

```text
Conversion of type 'Promise<any>' to type '{ ok: boolean; data?: ... }' may be a mistake...
Property 'ok' is missing in type 'Promise<any>'...
```

The failing statement cast each unresolved `delegate()` promise inside `Promise.all`. Its retry removed the bad casts and completed all delegates. This was a recovered error, but the subsequent behavior was fatal to the step: it rendered the interim message *“I've read everything you sent. Here's what I found across your material — then I have a proposal.”* instead of the required actual offer. `display()` ended the turn, so the runner's next scripted *“Yes please.”* arrived before THING had offered anything. The complete attempt-1 session exchange is retained in the runner evidence for the failing step.

No spaces, app tables, pages, or app were created on step 01, so the only failed assertion was the required offer.

## Attribution

**Rung: L1 — prompt.**

The primitive worked: the first attempt's retry successfully delegated the supplied file IDs and image ID, and the system returned usable document and vision text. Nothing threw after the model used `Promise.all` without the invalid casts. The problem was THING choosing unsafe code despite its goal, followed by treating an interim progress marker as a user-facing reply. The existing prompt did not make either constraint explicit enough. A lower L0 change would only weaken a valid contract: a person must receive the offer before their affirmative answer can authorize authoring.

## Product changes (uncommitted)

### `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`

**Rung:** L1.

1. Replaced the attachment example's sequential delegates with a correct parallel `Promise.all` example and stated that `delegate()` is already a promise and must not be cast inside the array.

   **General principle:** when composing asynchronous capability calls, await the actual promises; do not assert their resolved shape before awaiting them.

2. Made the response boundary explicit: `display()` is the user-facing response and ends the turn, so it must never be used as a progress marker. After material is read, THING must construct and make one final user-facing display containing the actual offer and its question.

   **General principle:** an orchestrator may not emit a preparatory response that ends a decision turn before it presents the decision the user must answer.

### `org/docs/system-spaces/README.md`

**Rung:** documentation synchronized with the L1 prompt change.

The THING attachments section now documents the concurrent `Promise.all` behavior, the no-pre-await-cast rule, and cites the precise prompt section.

## Verification evidence — attempt 2

Artifact: `attempt-2/step-01.json`

Fresh replay command used `--fresh-server --through 1`. Step 01 has:

- `errors: []`;
- delegates to `system-vision/vision`, `system-files/dispatch`, `system-files/sheet`, and `system-files/reader`;
- file-reader yields for the notes/PDF and sheet-reader yields for the XLSX;
- a final offer that names actual source details: the Aug 3–20, 2026 trip; Vasilis and Athina Mari; the crater/Ngorongoro and Zanzibar; the cost spreadsheet; and the voice memo;
- state with `spaces: []`, `appTables: {}`, `pages: []`, and `built: false`.

The runner completed `played 1/18 steps` cleanly. This proves the offer was made after all evidence was gathered and before any authoring.

Validation also passed:

```text
pnpm --dir /home/vasilis/LMTHING/lmthing docs:check

docs-check: 118 docs, 4554 citations (1569 symbol, 2985 line)
✓ all citations resolve
```

The rebuilt CLI copied the updated system-space source into `sdk/org/libs/cli/dist/system-spaces` before attempt 2.

## Overfitting check

I grepped the added THING prompt diff for the scenario-specific literals `Vasilis`, `Athina`, `Tanzania`, `Ngorongoro`, `Zanzibar`, `Emmanuel`, `Richard`, `ZZJQUU`, and `3344`; it produced no matches. The prompt changes name only general async/delegation and response-boundary rules.

## Working-tree note

No files were staged, committed, stashed, or reverted. The two pre-existing modified attempt-1 files remain untouched except for runner-generated artifacts. Product changes are deliberately uncommitted for human review.
