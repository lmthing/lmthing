---
id: attach-flows-to-agents
output:
  flowsAttached: string[]
  slashCommands: string[]
dependsOn:
  - design-your-agents
optional: false
goal: false
---

Guide the user to attach flows to agents via the Actions tab on each Agent Configuration page.

For each agent, walk through:
1. Navigate to the Agent Configuration page
2. Open the **Actions** tab in the right panel
3. Click **Attach Flow** to open the workflow selection modal
4. Select the appropriate flow and confirm

Once attached, explain the action card that appears:
- The slash command (e.g., `/explain`)
- The flow name and step count
- The Active status badge (green)

Explain flow management: hover over a card to reveal edit / disable / detach options. Toggle Active ↔ Inactive without losing the attachment by clicking the status badge.

If flows don't exist yet, guide the user to create them by adding markdown files to `tasklists/flow_*/` directories.

currentTask.resolve({ flowsAttached: ["<flow_id_1>", "<flow_id_2>"], slashCommands: ["/<cmd1>", "/<cmd2>"] });
