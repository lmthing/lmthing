# app builds are correct but expensive: ~18–28 min, ~1.7M tokens per build

**Evidence:** 07 run 19/22 `build_live_project` ≈18 min / ~1.7M cumulative input tokens;
06 run 25 build >20 min; 06 run 29 build 25 min (2026-07-19). Correctness is now good
(build-completeness gate + retry) — the cost is the problem: it dominates scenario wall-clock and
makes every verification loop slow.

**Directions (needs its own design pass):**
- Fewer gate-and-retry round trips: compile_pass/fix_pass re-reads whole artifacts per iteration;
  bound the fix-pass input to the failing file + its imports.
- Cheaper models on mechanical nodes (schema writing, import fixing) via per-role/per-node model
  assignment (`roleModels` exists in core).
- Parallelize per-page/per-endpoint nodes (forEach already exists for pages; extend to endpoints).
- Measure first: per-node token/duration breakdown from the build trace to find the actual hot spots.

**Where:** `sdk/org/libs/core/system-spaces/system-appbuilder/**` (build_live_project tasklist).
