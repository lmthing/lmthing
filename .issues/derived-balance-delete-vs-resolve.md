# data nuance: hard-deleting a "balance due" line zeroes a genuinely outstanding balance

**Symptom** (06 run 25 step 9, low priority): resolving a double-count by hard-deleting the
"Balance due" line also zeroed `safari_balance_outstanding` — but the $960 is still owed. The
correction was right; the data model conflated "this line double-counts in the total" with "this
obligation no longer exists".

**Direction:** when a flagged-figure fix targets a line that REPRESENTS an obligation (balance due,
deposit owed), prefer mark-resolved/exclude-from-total over hard delete, or re-derive the
obligation into its proper field before deleting. Belongs in the resolve_flagged_figure tasklist's
fix node as a general principle (no domain literals).

**Where:** `sdk/org/libs/core/system-spaces/user-thing/tasklists/resolve_flagged_figure/02-fix.md`.
