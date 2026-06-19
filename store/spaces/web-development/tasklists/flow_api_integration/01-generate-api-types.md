---
id: generate-api-types
output:
  types: string
dependsOn: []
optional: false
goal: false
---

Generate TypeScript interfaces and types for API requests, responses, and error handling. Include proper type discrimination for union types, optional fields marked correctly, and proper nested object types. Consider pagination, filtering, and sorting types if applicable.

```typescript
currentTask.resolve({ types: generatedTypesCode });
```
