---
id: generate-error-handling
output:
  errorHandling: string
dependsOn:
  - generate-api-endpoints
optional: false
goal: false
---

Generate error handling classes and utilities including custom API error types, error response parsing, retry logic with exponential backoff, and request cancellation support. Handle network errors, timeout errors, and HTTP error status codes appropriately.

```typescript
currentTask.resolve({ errorHandling: generatedErrorHandlingCode });
```
