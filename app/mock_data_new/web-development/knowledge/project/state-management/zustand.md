# Zustand

Small, fast state management solution.

**Usage:**
```tsx
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 }))
}))
```

**Benefits:**
- Minimal boilerplate
- No providers needed
- TypeScript support
- Can be used outside React
- DevTools integration