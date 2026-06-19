---
id: configure-runtime-fields
output:
  runtimeFields: string
  fieldsConfigured: string[]
dependsOn:
  - attach-flows-to-agents
optional: false
goal: false
---

Guide the user to configure runtime fields — knowledge fields whose values are prompted from the user at conversation start rather than pre-filled.

Explain the configuration in `instruct.md` frontmatter:

```yaml
runtimeFields:
  domain-name:
    - field-slug
    - another-field-slug
```

Use runtime fields for:
- **User-specific values** — name, company, role
- **Session-specific choices** — task goal, target audience
- **Dynamic configurations** — anything that changes per conversation

For each agent in the workspace, review its knowledge domains and identify which fields should be runtime fields. Explain the tradeoff: more runtime fields = more user control but more friction per session.

Best practices: mark frequently-changing values as runtime; default stable values; only mark `required: true` for fields that genuinely block good output.

currentTask.resolve({ runtimeFields: "<YAML snippet of configured runtimeFields>", fieldsConfigured: ["<domain/field>", "..."] });
