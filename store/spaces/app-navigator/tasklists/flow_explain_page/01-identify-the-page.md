---
id: identify-the-page
output:
  pageName: string
  pageUrl: string
dependsOn: []
optional: false
goal: false
---

Ask the user which page they want to explore. Offer the four main page areas:

- **Home Page** (`/`) — public-facing landing page with workspace selection
- **Studio Dashboard** (`/workspace/[workspaceId]/studio`) — the main workspace hub
- **Agent Configuration** (`/workspace/[workspaceId]/studio/agent/[agentId]`) — configure a specific agent
- **Knowledge Area Details** (`/workspace/[workspaceId]/studio/domain/[domainId]`) — browse and edit knowledge files

Ask: "Which page would you like to understand? You can describe it by name or by the URL path."

Once the user identifies the page, confirm it by restating the full name and URL.

currentTask.resolve({ pageName: "<identified page name>", pageUrl: "<identified page URL pattern>" });
