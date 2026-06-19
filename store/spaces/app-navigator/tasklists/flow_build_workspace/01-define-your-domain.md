---
id: define-your-domain
output:
  domainName: string
  targetUsers: string
  useCases: string[]
  expertKnowledge: string[]
dependsOn: []
optional: false
goal: false
---

Before building a workspace, establish a clear domain definition. Guide the user to answer:

1. **What is the domain?** (e.g., "customer support", "recipe management", "code review")
2. **Who are the users?** (e.g., developers, marketers, teachers)
3. **What problems does this workspace solve?** Identify 2–3 core use cases.
4. **What knowledge does an expert in this domain carry?** Think about:
   - Terminology and vocabulary
   - Common decision trees
   - Reference data (templates, standards, examples)
   - User context (preferences, history)

Ask these questions one at a time, wait for responses, then synthesize a short domain summary. Confirm the summary with the user before proceeding.

currentTask.resolve({ domainName: "<domain name>", targetUsers: "<user description>", useCases: ["<use case 1>", "<use case 2>"], expertKnowledge: ["<knowledge area 1>", "<knowledge area 2>"] });
