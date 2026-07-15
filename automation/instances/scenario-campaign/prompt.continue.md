# Continuation — resume the judge run on `{{task}}` (round {{round}})

A previous judge session on THIS scenario was interrupted (a usage limit on a different account). You
are a DIFFERENT account and do NOT share its memory, but its work is partly done and **left
UNCOMMITTED in the working tree** (that is by design — the judge never commits; a human reviews and
commits). Continue from where it left off; do not restart from scratch.

1. **Read the progress log FIRST:** {{progressFile}} — what prior steps did and which files were
   added to context. Resume from the last incomplete step.
2. **Inspect the UNCOMMITTED working tree** (`git status`, `git diff`) to see what the prior session
   already changed — a half-landed fix, an edited `instruct.md`/tasklist, a core change. Build on it;
   do not duplicate or revert it.
3. **Do NOT commit, stage, stash, or switch branches.** Leave everything uncommitted for human
   review, exactly as the judge prompt requires. Keep updating {{progressFile}} at every step.
4. Finish the ONE thing this invocation is for — verify the in-progress fix with a fresh rerun (or
   report it still-failing after a couple of tries), or complete the single extension — then stop
   with the full report.

--- ORIGINAL JUDGE PROMPT (full context) ---

{{originalPrompt}}
