# PROGRESS — THING creates live projects; remove store-catalog app-authoring

**Goal:** THING owns live `createProject`/`selectProject` (real projects under `.lmthing/<id>/`) and
directs the automator to build the app INTO the selected live project. The store-catalog
app-AUTHORING flow (`build_app`/app-architect + catalog `createProject`/`selectProject`/`writePage`/
`writeApi`/`writeHook`/`writeTableSchema`) is removed. Store **install** stays untouched. No client work.

**Decisions (FINAL rule set):**
- App-build TARGET depends on the current project:
  - current != `user`  → build INTO the current project (existing live automator path — KEEP).
  - current == `user`  → THING ASKS for a name, creates a NEW project, builds into IT (retarget).
- THING NEVER builds an app into the `user` project.
- Retarget is needed for the `user` case (create-then-build-into-new within one session). "Build in current"
  path stays for real projects (automator inherits the session project, no retarget).
- No chat/UI project switch — THING just retargets the build. User finds the new project on next sidebar poll.
- `project:manage` repurposed catalog→live; granted to THING. Store INSTALL untouched.
- REMOVE store-catalog app-AUTHORING (build_app/app-architect + catalog create/select/writePage/Api/Hook/TableSchema).

## Mechanism (the one new thing)
- Session gains mutable `activeBuildProjectId` (default = session projectId).
- `createProject(name)` → `manager.createProject` → scaffold `.lmthing/<id>`, auto-select as build target.
- `selectProject(id)` → validate exists, set `activeBuildProjectId`.
- `delegate(...)` → if build target ≠ session project, resolve target's projectRoot/projectId/
  projectSpacesDir + appGlobals via `manager.getProjectAppGlobals(target)` and pass THOSE to runDelegate.

## Tasks
- [x] P1 cli foundation: projects.ts `createProjectSync`/`scaffoldProjectSync`/`uniqueProjectIdSync`; manager.createProject unified onto sync core (typechecks clean)
- [ ] P1 core: session.ts (`resolveBuildTarget` opt + `delegateProjectContext()` centralizing 4 runDelegate call sites @684/756/804/1056), app-globals.ts (live create/select fields + project:manage inject), library-dts.ts (PROJECT_MANAGE_DTS live)
- [ ] P1 cli: session-manager.ts (wire live createProject/selectProject + getProjectAppGlobals retarget; drop getAuthoringGlobals), app/authoring/globals.ts (remove createAppAuthoringGlobals; keep createProjectAuthoringGlobals + resolveCatalogRoot)
- [ ] P2 spaces: delete app-architect + build_app + publish_app; rewrite THING instruct.md (grant project:manage; new create→build flow; drop 4b)
- [ ] P2 tests: rewrite catalog tests → live create/select + delegate-retarget; keep catalog-root.test.ts
- [ ] P2 docs: runtime-globals/app-authoring.md, system-spaces/README.md, capability/delegation pages (docs:check gate)
- [ ] Verify: run "create a todo app" against local pod → new .lmthing/<id> project + working /app/<id>/

## Fan-out (Opus subagents, disjoint file sets)
- [x] Agent A — libs/core DONE + core typechecks clean: DelegateProjectContext type; session.ts delegateProjectContext() + 4 sites (692/756/802/1056); app-globals.ts removed writePage/writeApi/writeHook/writeTableSchema (fields+inject); library-dts.ts removed PAGES/API/HOOKS/WRITE_TABLE catalog DTS, kept PROJECT_* + PROJECT_MANAGE; bootstrap.ts db:schema→PROJECT_TABLE_DTS; capability.ts comment. FOLLOWUP(mine): library-dts.test.ts imports removed consts → 4 errors to fix in test pass.
- [x] Agent B — libs/cli DONE: buildTarget holder + live create/select + resolveBuildTarget wired at defaultBuildSession (session-manager.ts:406/422/443), gated `if (projectId && projectRoot && appGlobals && root)`; removed createAppAuthoringGlobals/getAuthoringGlobals/6 catalog assigns; kept resolveCatalogRoot; FIXED bin.ts --request catalog path→createProjectAuthoringGlobals. FOLLOWUP(mine): globals.test.ts imports removed createAppAuthoringGlobals → test pass. Cross-pkg resolveBuildTarget errors clear on core rebuild.
- [x] Agent C — system-spaces DONE: deleted app-architect/build_app/publish_app; THING instruct.md rewritten (project:manage granted, create-or-build-in-place rules, 4b removed); fixed dangling refs in app_building knowledge + architect frontmatter docs + automator cron example; RENAMED organize_material/04-build_app.md→04-build_live_app.md (id build_live_app). VERIFY(mine): organize_material index still resolves the renamed step; orphaned data-modeler/page-builder/api-author specialists now unreachable (harmless).
- Agent D — org/docs: app-authoring.md, system-spaces/README.md, capability/delegation pages.
- ME: [x] projects.test.ts (createProjectSync 6/6 green) · [x] core+cli rebuilt clean · [x] session+delegate tests 27/27 green (retarget no-regress) · [x] organize_material rename resolves · [ ] test-fix agent (5 files) landing · [ ] docs agent landing · [ ] FULL suite · [ ] docs:check · [ ] LIVE "create a todo app" verification
- NOTE: automator canDelegateTo:[] + delegate() example in prose = PRE-EXISTING warning, non-fatal, not my regression.

## Integration status (all green except live run in progress)
- [x] core+cli rebuilt clean; full suite 1581 pass / 5 fail (ALL pre-existing: mock-session+harness-features 20s timeouts+ENOTEMPTY, apps/web install.test vite alias — confirmed via git stash clean-tree run; NOT my regression)
- [x] projects.test.ts createProjectSync 6/6; session+delegate 27/27
- [x] docs agent DONE (21 files); docs:check GREEN (4594 citations resolve) after fixing 3 (AppAuthoringGlobals→schemaToCreateTableSql/writeProjectPage; app-globals line-drift 238-241→230-233 + :29/:37 refs)
- [x] slice specialists data-modeler/api-author/page-builder KEPT (orphaned, harmless) — docs reflect existence
- [x] LIVE run #1: INFRA PROVEN — THING createProject'd a NEW `my-todos` project (NOT user), createProject returned {ok,appId,root}, user project stayed empty. BUT app not built: THING did createProject→display(proj)→STOPPED (didn't chain to automator delegate). Also turn-1 had a </think> leak → typecheck error (model artifact, not my bug).
  → FIX: strengthened THING instruct.md "createProject is NOT the finish line — step 1 of 2, MUST delegate automator in SAME turn; created-but-unbuilt = FAILURE". Rebuilt cli (dist/system-spaces updated).
- [x] LIVE run #2 (strengthened prompt): ✅ FULL SUCCESS end-to-end. THING created NEW `my-todos` (not user) → chained to automator → built todos table + full CRUD api (list/create/toggle/delete) + pages; /app/my-todos/ → 200; 3 seed rows LIVE (wash dog/buy house/find love) via api; user project stayed empty; THING reported correct /app/my-todos/ URL.
- OBSERVATION: local DeepSeek model occasionally leaks `</think>` into first statement → 1 wasted typecheck-error turn; THING recovers. Model artifact, not feature bug; stronger prod model unaffected.

## ✅ FEATURE COMPLETE — all green, live-verified. UNCOMMITTED (user's call to commit).
Delivered: THING creates live projects (project:manage: createProject/selectProject) + retargets the automator build into the new project (resolveBuildTarget/DelegateProjectContext); never builds into `user`; store-catalog app-authoring removed (app-architect/build_app/publish_app + catalog writers/globals); store install untouched. Build+typecheck clean, full suite 1581 pass (5 pre-existing fails), docs:check green, live-verified.
- REMINDER: `sleep` in FOREGROUND Bash is BLOCKED (whole cmd fails, no output). freshLocalServer now kills-by-port so no pre-kill needed.

## Notes / findings
- store/apps/ does NOT exist on disk — only store/projects/ (fix stale comments app-globals.ts:58, library-dts.ts:254).
- resolveCatalogRoot stays (routes/apps.ts install engine uses it).
- automator = KEEP (live builder); app-architect = REMOVE (catalog builder).
