---
id: test-with-thing-assistant
output:
  testResults: string
  iterationsNeeded: string[]
  workspaceReady: boolean
dependsOn:
  - configure-runtime-fields
optional: false
goal: true
---

Guide the user through testing their new workspace using the Thing assistant and the agent chat sandbox.

**Step 1 — Open Thing**
Click the **Thing** button in the top-right header. A sliding side panel (C10) opens from the right. The button text changes to "Hide Thing".

**Step 2 — Run workspace status check**
Type `status` in the Thing input to get an overview of workspace structure: number of agents, flows, knowledge areas, configuration validity, and runtime field summary.

**Step 3 — Test agent actions via chat sandbox**
On each Agent Configuration page, click the violet **Chat** floating button (C9, bottom-right) to open the Runtime Conversation Preview. Test with real messages to verify:
- Instructions are interpreted correctly
- Knowledge context is injected as expected
- Slash commands trigger the right flows

**Step 4 — Iterate and refine**
Based on test results, guide the user back to the appropriate part of the workspace to adjust:
- Agent instructions (Main Instructions textarea)
- Knowledge area content (edit files in the tree explorer)
- Attached flows and their steps

Summarize what worked, what needed adjustment, and confirm the workspace is ready.

currentTask.resolve({ testResults: "<summary of test outcomes>", iterationsNeeded: ["<item adjusted>", "..."], workspaceReady: true });
