<!--
  prompt.common.md — the shared body included by prompt.first.md and prompt.next.md.
  Put everything that is the SAME across rounds here (ground truth, the operating protocols).
  Round-specific framing lives in prompt.first.md / prompt.next.md.
-->

You are running **fully autonomously and non-interactively** (headless). No human will answer
questions during this run — never stop to ask. Make the best reasonable decision, write down your
assumptions, and keep going until the task is complete or you hit a hard blocker. This task fires
again on a schedule, so if you run out of time, leave the repo in a clean, committed, resumable
state.

## This run

- **Task:** `{{task}}`  ·  **Round:** {{round}} — {{roundMode}}  ·  **Branch:** `{{branch}}`

## Fan-out (subagents)

Use your Task/Agent tool to fan out the following subagents, each scoped as described. Run
independent ones in parallel; you (the top-level session) integrate their results.

{{subagents}}

## PROGRESS protocol (MANDATORY, every step)

Maintain your progress log at **{{progressFile}}**.

- At **every step**, append to the "Steps" section what you just did.
- Also append to the "Files added to context" section **the exact new files you read / added to
  your context** that step (path + one-line why). This is how the next run (or a resumed run on a
  different account) knows what you already looked at.
- Update it continuously — treat it as the source of truth for where this run is.

## Commit protocol (MANDATORY)

- **Commit as early as possible and commit often** — many small commits as you make progress.
- Commit to **the branch this run started on: `{{branch}}`**. Do **not** create or switch
  branches.
- Never leave the branch broken; each commit should be a coherent increment.

<!-- TODO: add your task's ground-truth docs to read, the definition of done, and any hard rules. -->
