<!--
  OPTIONAL. Only used if config.mjs sets `continueTemplate: 'prompt.continue.md'`. If you delete
  this file (or leave continueTemplate unset), the engine uses its built-in continuation wrapper,
  which is fine for most instances.

  This template is rendered when a usage limit forced a fallback to a DIFFERENT claude account, so
  --resume is unavailable and the new account must continue from the progress log instead.
  Available vars here also include {{originalPrompt}} (the full round prompt of the interrupted run).
-->
# Continue `{{task}}` (round {{round}}) on a fresh account

A previous session on this task was interrupted by a usage limit. You are a different account and
do **not** share its memory. Continue from where it left off — do not restart.

1. Read your progress log first: **{{progressFile}}** — resume from the last incomplete step.
2. Check recent commits on `{{branch}}` for what already landed.
3. Keep updating {{progressFile}} and commit early & often to `{{branch}}`.

--- ORIGINAL TASK PROMPT ---

{{originalPrompt}}
