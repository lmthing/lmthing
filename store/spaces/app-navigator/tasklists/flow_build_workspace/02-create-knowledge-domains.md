---
id: create-knowledge-domains
output:
  domains: string[]
  domainSlugs: string[]
dependsOn:
  - define-your-domain
optional: false
goal: false
---

Using the domain definition from the previous step, guide the user to create 3–4 top-level knowledge domains in the Studio Dashboard.

For each domain, provide:
- **Name** — a concise label (e.g., "Customer Profile")
- **Description** — what types of knowledge live here
- **Slug** — the kebab-case folder name (e.g., `customer-profile`)
- **Icon** — a single emoji
- **Color** — a hex color appropriate to the domain type

Recommend domain candidates based on the expert knowledge areas identified in the previous step. For each, explain what sub-fields and option files would live inside.

Good domain patterns: `user-profile`, `platform-config`, `content-type`, `workflow-context`

Walk the user through creating each domain via the Studio Dashboard → Knowledge section → "+ Create Knowledge". Confirm each domain slug before moving on.

currentTask.resolve({ domains: ["<Domain Name 1>", "<Domain Name 2>"], domainSlugs: ["<slug-1>", "<slug-2>"] });
