# lmthing

lmthing is a complete platform for building, managing, and deploying AI agents with structured knowledge. It combines a powerful TypeScript agent framework with an intuitive visual studio.

## Components

### 🎨 Lmthing Studio (`app/`)

A visual interface for building AI agents without code. Studio provides:

- **Agent Builder**: Configure AI agents with custom prompts, tools, and behaviors
- **Knowledge Management**: Organize markdown-based knowledge into searchable domains
- **Flow Builder**: Design multi-step workflows with a visual editor
- **Agent Runtime**: Test and interact with agents in real-time conversations
- **THING Assistant**: AI-powered workspace generation that creates complete agent setups from natural language descriptions

Built with React, TypeScript, and Vite. Perfect for domain experts who want to create AI agents using their expertise without writing code.

### ⚙️ Lmthing Agent Framework (`lib/core/`)

A TypeScript/JavaScript library for building sophisticated AI agents with stateful prompts and tool execution.

**Key Features:**
- **StatefulPrompt**: React-like hooks (`defState`, `defEffect`) for managing agent state across conversation steps
- **Tool System**: Define and execute custom tools with built-in validation and error handling
- **Multi-Provider Support**: Works with OpenAI, Anthropic, Google, and other LLM providers
- **Streaming**: Native support for streaming responses and tool execution
- **CLI & Runtime**: Run agents from the command line or embed in your applications

The framework powers the Studio runtime and can be used independently to build custom AI applications.

## Getting Started

```bash
# Install dependencies
pnpm install

# Run Studio in development mode
pnpm --filter app dev

# Build the agent framework
pnpm --filter @lmthing/core build

# Run agent framework examples
cd lib/core && pnpm run example:basic
```

## Documentation

- [Studio Documentation](./app/README.md)
- [Agent Framework Documentation](./lib/core/README.md)
- [Getting Started Guide](./docs/getting-started.md)
- [Product Overview](./docs/product-planning.md)

## Repository Structure

```
lmthing/
├── app/              # Lmthing Studio (React application)
├── lib/
│   └── core/        # Agent framework (TypeScript library)
├── docs/            # Documentation
└── page-descriptions/ # UI specifications
```

## License

See [LICENSE](./app/LICENSE) for details.
