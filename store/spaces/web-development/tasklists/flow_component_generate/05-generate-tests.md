---
id: generate-tests
output:
  tests: string
dependsOn:
  - generate-event-handlers
optional: false
goal: true
---

Generate comprehensive tests using React Testing Library and Vitest. Include tests for: rendering with different props, user interactions (click, type, submit), accessibility attributes, and edge cases. Use getBy*, queryBy*, and findBy* selectors appropriately. Include setup helpers and mock data where needed.

```typescript
currentTask.resolve({ tests: generatedTestsCode });
```
