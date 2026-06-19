---
id: generate-api-tests
output:
  tests: string
dependsOn:
  - generate-data-hooks
optional: false
goal: true
---

Generate tests for the API integration layer using MSW for mocking. Include tests for: successful requests, error responses, loading states, retry logic, and request cancellation. Set up proper request/response handlers for mocked API calls.

```typescript
currentTask.resolve({ tests: generatedTestsCode });
```
