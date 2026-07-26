# runtime: budget near-limit warning tells the top-level session to call currentTask.resolve() — which it doesn't have

**Symptom:** `nearLimitWarning()` ends every warning with "Wrap up immediately and call
currentTask.resolve() now" (`budget.ts:131`) and the turn loop appends it to the VARIABLES block
unconditionally (`turn-loop.ts:916-917`) — including for the top-level session. `currentTask` is
injected only when `currentTaskResolve` is supplied (`bootstrap.ts:135-140`) and `createSessionVM`
never supplies it, nor is `CURRENT_TASK_DTS` emitted for sessions. A budget-pressured session that
obeys gets a guaranteed `Cannot find name 'currentTask'` typecheck error and burns a retry exactly
when it has the fewest left.

**Direction:** make Budget return structured data ({kind, used, limit, remaining}) and let the turn
loop render the wrap-up sentence from the capability profile it already has — `currentTask.resolve()`
when declared, "display() the partial result" otherwise.

**Where:** `sdk/org/libs/core/src/eval/budget.ts:131`; `sdk/org/libs/core/src/eval/turn-loop.ts:916-917`;
`sdk/org/libs/core/src/exec/bootstrap.ts:135-140`.
