---
id: generate-data-hooks
output:
  hooks: string
dependsOn:
  - generate-error-handling
optional: false
goal: false
---

Generate custom React hooks that wrap the API endpoints for common data fetching patterns. Include hooks for: fetching single items, fetching lists with pagination, mutations (create/update/delete), and optimistic updates. Return consistent loading, error, and data states.

```typescript
currentTask.resolve({ hooks: generatedHooksCode });
```
