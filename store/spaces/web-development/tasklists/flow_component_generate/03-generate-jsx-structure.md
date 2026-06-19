---
id: generate-jsx-structure
output:
  jsx: string
dependsOn:
  - generate-component-structure
optional: false
goal: false
---

Generate clean, semantic JSX markup using the project's CSS framework (Tailwind CSS). Include proper accessibility attributes (ARIA labels, roles), semantic HTML elements, and responsive design considerations.

```typescript
currentTask.resolve({ jsx: generatedJsxCode });
```
