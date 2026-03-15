# StatefulPrompt — State & Effects System

## Overview

`StatefulPrompt` (`src/StatefulPrompt.ts`) is the main prompt class that provides all prompt-building functionality including React-like hooks for managing state across prompt re-executions.

## Key Features

1. **State Persistence**: State values persist across re-executions using `defState`
2. **Effects System**: Side effects run based on dependency changes using `defEffect`
3. **Re-execution Model**: Prompt function re-executes on each step after the first
4. **Definition Reconciliation**: Automatically removes unused definitions from previous executions

## defState

Similar to React's `useState`, creates state that persists across re-executions:

```typescript
// Create state with initial value
const [count, setCount] = prompt.defState('counter', 0);
const [user, setUser] = prompt.defState('user', { name: 'John' });

// Access current value (proxy works in templates)
prompt.$`Current count: ${count}`;

// Update state
setCount(5);                    // Direct value
setCount(prev => prev + 1);     // Function update
setUser(prev => ({ ...prev, age: 30 }));
```

## getState

Get the current value of any state key without creating a new state accessor:

```typescript
const [count, setCount] = prompt.defState('counter', 0);

// Later, access without needing the original reference
const currentValue = prompt.getState<number>('counter'); // 0

setCount(5);
const updatedValue = prompt.getState<number>('counter'); // 5

// Useful for accessing state from plugins or effects
prompt.defEffect(() => {
  const currentCount = prompt.getState<number>('counter');
  console.log('Count is:', currentCount);
}, []);
```

**When to use `getState` vs `defState`:**
- Use `defState` when you need both read and write access to state
- Use `getState` when you only need to read the current value (e.g., in effects, tools, or plugins)

## defEffect

Similar to React's `useEffect`, runs effects based on dependencies:

```typescript
import { PromptContext, StepModifier } from 'lmthing';

// Effect without dependencies - runs every step
prompt.defEffect((context: PromptContext, stepModifier: StepModifier) => {
  console.log('Step:', context.stepNumber);

  // Modify the current step
  stepModifier('messages', [{
    role: 'system',
    content: `Step ${context.stepNumber}`
  }]);
});

// Effect with dependencies - runs only when dependencies change
prompt.defEffect((context, stepModifier) => {
  console.log('Count changed to:', count);
}, [count]);
```

**PromptContext provides:**
- `messages`: Current message history
- `stepNumber`: Current step (0-indexed)
- `tools`: ToolCollection utility
- `systems`: SystemCollection utility
- `variables`: VariableCollection utility
- `lastTool`: Info about last tool call

**StepModifier API:**
- `stepModifier('messages', items)`: Add/modify messages
- `stepModifier('tools', items)`: Add/modify tools
- `stepModifier('systems', items)`: Add/modify systems
- `stepModifier('variables', items)`: Add/modify variables

## Re-execution Flow

1. **Initial Execution**: Prompt function runs once to set up initial state
2. **Step 1**: Executes with initial state
3. **Re-execution**: For each subsequent step:
   - Prompt function re-runs with current state
   - Definitions are reconciled (unused ones removed)
   - Effects are processed based on dependencies
   - Step modifications are applied

## Definition Reconciliation

StatefulPrompt tracks which definitions are used in each execution and removes unused ones:

```typescript
// First execution
const tool1 = prompt.defTool('tool1', ...);
const tool2 = prompt.defTool('tool2', ...);

// Second execution (only tool1 referenced)
// tool2 is automatically removed
```

## Message Duplication Prevention

StatefulPrompt prevents duplicate user messages during re-execution:

```typescript
// This message is only added once, even on re-execution
prompt.$`Help me with this task`;
prompt.defMessage('user', 'Additional context');
```
