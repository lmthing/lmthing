# architect: cannot build OPERATIONAL spaces (tasklists/cron/events) — blocks scenario 10

**Symptom:** the architect's `synthesize_and_run` scaffold produces ADVICE specialists (knowledge +
answer + research_and_store). It cannot produce an operational space: one with its own tasklists,
cron/event emitters, and working functions. Scenario 10 (family-recipes) requires exactly that and
is blocked on it (campaign deferred item #3).

**Fix direction (L2 in system-architect):** extend the scaffold vocabulary — design node classifies
requested capabilities (advice vs operational); operational designs emit tasklist/event/function
writers (the writers exist as builder functions; the scaffold just never uses them). Keep the
advice path unchanged.

**Verify:** scenario 10 migration + first run reaches its operational steps.
