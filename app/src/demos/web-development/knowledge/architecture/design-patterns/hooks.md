# Custom Hooks Pattern

Extract reusable stateful logic.

**Naming:**
- Always start with `use`
- Reflect the purpose: `useFetch`, `useForm`

**When to Create:**
- Duplicated stateful logic
- Complex state with side effects
- Shared behavior across components

**Example:**
```tsx
function useLocalStorage<T>(key: string, initial: T) {
  // ... implementation
}
```