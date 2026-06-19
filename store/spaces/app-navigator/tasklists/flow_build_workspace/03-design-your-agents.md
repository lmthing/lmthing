---
id: design-your-agents
output:
  agents: string[]
  agentSlugs: string[]
  agentInstructions: string
dependsOn:
  - create-knowledge-domains
optional: false
goal: false
---

Guide the user to design 2–3 agents with distinct, complementary roles for their workspace.

For each agent, define:
1. **Name** — PascalCase (e.g., `ContentWriter`, `QAReviewer`)
2. **Description** — one clear sentence describing its expertise
3. **Main Instructions** — a system prompt covering: role and personality, tone and communication style, what it knows (from attached knowledge), what it should and shouldn't do
4. **Knowledge domains** — which domains from the previous step to attach (use the pills bar)

Walk the user through creating each agent via Studio Dashboard → Agents section → "+ Create Agent". After creation, guide them to attach knowledge domains using the pills bar on the Agent Configuration page.

Remind the user: agents inherit context from selected knowledge domains — attach only what's relevant. Keep instructions focused; avoid redundancy with knowledge content.

currentTask.resolve({ agents: ["<AgentName1>", "<AgentName2>"], agentSlugs: ["<agent-slug-1>", "<agent-slug-2>"], agentInstructions: "<summary of instruction patterns used>" });
