---
id: generate-hook-signature
output:
  signature: string
dependsOn: []
optional: false
goal: false
---

Generate a custom React hook signature with properly typed parameters and return value. The hook name should start with 'use'. Include clear TypeScript types for all parameters and the return type (typically an array or object for multiple return values).

```typescript
currentTask.resolve({ signature: generatedSignatureCode });
```
