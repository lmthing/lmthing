# Attempt ledger — 06-tanzania

Cross-round memory for the judge. **Read this before attributing a failure**; **append one entry at
the end of every round.** One line per attempt. This is how a fresh-context round knows a rung is
already exhausted and it must CLIMB instead of re-trying the same rung.

Format per line:
`R<round> · step <N> · <L0|L1|L2|L3> · <file#symbol> · verify=<PASS|FAIL|INTERRUPTED> · <evidence>`

_(reset — no prior attempts; the campaign starts fresh at round 1.)_

R1 · step 02 · L1 · sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/03-write_openable_app.md#write_openable_app · verify=FAIL · First replay's unnamed API was corrected, second replay reached page compilation and exposed unsupported imports, and third replay regressed to a partial data-only build (one `itinerary` table, zero pages); stop after three fresh replays.
