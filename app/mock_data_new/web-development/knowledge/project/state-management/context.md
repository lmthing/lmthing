# React Context

Built-in state sharing across components.

**Best Practices:**
- Split contexts by domain
- Use separate contexts for state and dispatch
- Memoize context values to prevent re-renders
- Consider lifting state before context

Avoid context for frequently changing values (bubbles re-renders).