# Context Functions — def*, $, and Proxy Methods

## Overview

The `StatefulPrompt` object provides context functions for building agentic workflows. These construct the arguments passed to the AI SDK's `streamText` function.

## defMessage

Adds a message to the conversation history. Only supports `'user'` and `'assistant'` roles.

```typescript
prompt.defMessage('user', 'Hello!');
prompt.defMessage('assistant', 'Hi there! How can I help?');
```

## defSystem

Adds a named system prompt part. Multiple parts are formatted as XML tags.

```typescript
prompt.defSystem('role', 'You are a helpful assistant.');
prompt.defSystem('guidelines', 'Always be polite and professional.');

// Results in:
// <role>You are a helpful assistant.</role>
// <guidelines>Always be polite and professional.</guidelines>
```

System parts can be dynamically filtered per-step using `defEffect` with `stepModifier('systems', ...)`.

## def (Variables)

Defines a variable prepended to the system prompt as XML.

```typescript
const userNameRef = prompt.def('USER_NAME', 'John Doe');
const contextRef = prompt.def('CONTEXT', 'Customer support conversation');

// Use returned reference in prompts
prompt.$`Please help ${userNameRef} with their question. Context: ${contextRef}`;
```

## defData

Defines a data variable containing JSON, formatted as YAML in the system prompt.

```typescript
const userData = prompt.defData('USER_DATA', {
  name: 'John Doe',
  age: 30,
  preferences: ['coding', 'reading']
});

// Formatted as:
// <USER_DATA>
// name: John Doe
// age: 30
// preferences:
//   - coding
//   - reading
// </USER_DATA>

prompt.$`Analyze the following user data: ${userData}`;
```

## $ (Template Literal)

Template literal tag function for adding user messages.

```typescript
prompt.$`Help ${userRef} with their question about ${topic}`;
// Adds: { role: 'user', content: 'Help <USER> with their question about AI' }
```

## Definition Proxy Methods

All `def*` methods return a proxy object that acts as a string in templates but provides utility methods:

```typescript
const userName = prompt.def('USER_NAME', 'Alice');

// Use in templates (acts as string '<USER_NAME>')
prompt.$`Hello ${userName}`;

// Access the tag value
console.log(userName.value);  // '<USER_NAME>'

// Mark for reminder - inserts a reminder message to the model
userName.remind();

// Disable for current step - removes definition from next step
prompt.defEffect((ctx, stepModifier) => {
  if (someCondition) {
    userName.disable();
  }
});
```

**Available methods on all definition proxies:**
- `.value` - Returns the XML tag string (e.g., `'<USER_NAME>'`)
- `.remind()` - Marks the definition to remind the model to use it
- `.disable()` - Removes the definition from the next step (use within `defEffect`)
- `.toString()` / `.valueOf()` - Returns the tag for string coercion

**Introspection:**
```typescript
const reminded = prompt.getRemindedItems();
// Returns: [{ type: 'def', name: 'USER_NAME' }, { type: 'defTool', name: 'search' }, ...]
```
