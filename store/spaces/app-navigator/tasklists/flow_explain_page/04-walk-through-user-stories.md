---
id: walk-through-user-stories
output:
  userStories: string[]
  storySummary: string
dependsOn:
  - explain-components
optional: false
goal: false
---

Walk through the key user stories for the identified page. Each story follows the format:

**As a** [user type] **I want to** [action] **So that** [benefit]

Cover the primary stories for the page. For each story, briefly describe what the user sees and what happens when they interact. Reference the component codes (C1–C10) and layout patterns (L1–L3) from previous steps where relevant.

Match the depth of explanation to the user's role from the `user-context/role` knowledge field — technical details for developers, plain-language walkthrough for non-technical users, high-level overview for product evaluators.

currentTask.resolve({ userStories: ["<US-NNN: story>", "..."], storySummary: "<narrative summary of the user journey>" });
