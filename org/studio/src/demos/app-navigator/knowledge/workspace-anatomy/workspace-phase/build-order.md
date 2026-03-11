---
title: Build Order & Creation Workflow
description: The recommended sequence for building a workspace from scratch
order: 3
---

# Build Order & Creation Workflow

When building a workspace, the order matters — later files reference earlier ones. Always follow this sequence to avoid broken references.

---

## Recommended Build Order

```
Phase 1: Foundation
────────────────────
1. Create workspace folder: app/src/demos/{slug}/
2. Write package.json

Phase 2: Knowledge Base (build this BEFORE agents)
────────────────────────────────────────────────────
3. For each knowledge domain:
   a. Create knowledge/{domain}/ folder
   b. Write knowledge/{domain}/config.json
   c. For each field in the domain:
      i.  Create knowledge/{domain}/{field}/ folder
      ii. Write knowledge/{domain}/{field}/config.json
      iii. Write option .md files for each choice

Phase 3: Flows (build BEFORE linking to agents)
─────────────────────────────────────────────────
4. For each flow:
   a. Create flows/flow_{id}/ folder
   b. Write all step files: 1.Step.md, 2.Step.md, ...
   c. Write flows/flow_{id}/index.md last (links to step files)

Phase 4: Agents (build LAST — references everything above)
────────────────────────────────────────────────────────────
5. For each agent:
   a. Create agents/agent-{name}/ folder
   b. Write agents/agent-{name}/values.json  ← always {}
   c. Write agents/agent-{name}/config.json  ← references knowledge paths
   d. Write agents/agent-{name}/instruct.md  ← references domains + flows
```

---

## Why This Order?

| Phase | Must exist before you write... |
|---|---|
| Knowledge domain folders | `selectedDomains` in `instruct.md` |
| Knowledge field folders | `emptyFieldsForRuntime` in `config.json` |
| Option files | `default` in field `config.json` |
| Flow folders + steps | `index.md` links + `flowId` in `instruct.md` |
| All of the above | `instruct.md` (validates against everything) |

---

## Studio UI vs. File System Build Approaches

### Via Studio UI (Recommended for non-technical users)
1. Open the Studio Dashboard
2. Click "+ Create Knowledge" → fill name and description → opens Knowledge Area Details
3. In the tree, click "+ New Folder" for each field, then "+ New File" for each option
4. Click "+ Create Agent" → fill name → opens Agent Configuration
5. Attach knowledge via pills, write Main Instructions, click "Attach Flow"

### Via File System (Recommended for technical users / AI generation)
Follow the build order above, writing files directly. Use the `status` command in the Thing panel to verify.

---

## Iterating on an Existing Workspace

| Change Type | What to Update |
|---|---|
| Add a new knowledge option | Add `.md` file in the field folder; optional: update `default` |
| Add a new field | Add folder + `config.json` + options; reference in agent's `emptyFieldsForRuntime` |
| Add a new domain | Add folder + `config.json` + fields; add to agent's `selectedDomains` |
| Add a new flow | Add flow folder + steps + `index.md`; add `<slash_action>` to agent's `instruct.md` |
| Add a new agent | Add agent folder + all 3 files; reference existing domains and flows |
| Rename a flow | Update folder name AND all `flowId` references in agents |
| Rename a domain | Update folder name AND all `selectedDomains` references in agents |

---

## Time Estimates

| Task | Estimated Time |
|---|---|
| package.json | 1 minute |
| One knowledge domain (3 fields, 3 options each) | 30–60 minutes |
| One complete flow (5 steps) | 20–30 minutes |
| One complete agent | 15–20 minutes |
| Full workspace (3 domains, 2 flows, 2 agents) | 2–4 hours |
| AI-generated workspace | 10–30 minutes |
