# Testing Library

User-centric testing approach.

**Principles:**
- Test user behavior, not implementation
- Queries mirror how users find elements
- Avoid testing internals

**Preferred queries (in order):**
1. `getByRole` - most accessible
2. `getByLabelText` - form elements
3. `getByPlaceholderText` - inputs
4. `getByText` - content

Avoid `getByTestId` unless necessary.