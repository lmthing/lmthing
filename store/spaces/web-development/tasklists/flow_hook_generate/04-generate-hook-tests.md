---
id: generate-hook-tests
output:
  tests: string
dependsOn:
  - generate-hook-utilities
optional: false
goal: true
---

Generate comprehensive tests for the custom hook using @testing-library/react-hooks. Include tests for: initial state, state updates, effect execution, cleanup, error cases, and edge cases. Use act() for state updates and waitFor for async operations.

```typescript
currentTask.resolve({ tests: generatedTestsCode });
```
