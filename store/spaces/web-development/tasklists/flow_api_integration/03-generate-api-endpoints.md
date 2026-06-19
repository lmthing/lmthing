---
id: generate-api-endpoints
output:
  endpoints: string
dependsOn:
  - generate-api-client
optional: false
goal: false
---

Generate typed API endpoint functions for CRUD operations (Create, Read, Update, Delete, List). Each function should have proper parameter typing, return type promises, and error handling. Include query parameter support and request body typing where applicable.

```typescript
currentTask.resolve({ endpoints: generatedEndpointsCode });
```
