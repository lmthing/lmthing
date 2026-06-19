---
id: generate-api-client
output:
  client: string
dependsOn:
  - generate-api-types
optional: false
goal: false
---

Generate a configured API client using fetch or axios with base URL configuration, timeout handling, and request/response interceptors for auth tokens and error handling. Include proper TypeScript typing for the client instance.

```typescript
currentTask.resolve({ client: generatedClientCode });
```
