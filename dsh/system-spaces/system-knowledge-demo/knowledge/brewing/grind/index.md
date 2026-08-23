# Grind settings

Which grind each method wants, in the bar's own burr-setting numbers. This field declares no
`variable` and no `type`, so both must default (`variableName` to the field slug `grind`, `type` to
`string`).

It is also the SIBLING FIELD the scoping tests need: the librarian declares `brewing/method` only,
so this field must be invisible to it and `loadKnowledge('brewing', 'grind', …)` must be refused.
