# Provider System — Model Resolution & Custom Providers

## Built-in Providers

Located in `src/providers/`:

| File | Provider |
|------|----------|
| `openai.ts` | OpenAI (GPT-4, GPT-3.5) |
| `anthropic.ts` | Anthropic (Claude) |
| `google.ts` | Google AI (Gemini) |
| `mistral.ts` | Mistral AI |
| `azure.ts` | Azure OpenAI |
| `groq.ts` | Groq |
| `cohere.ts` | Cohere |
| `bedrock.ts` | Amazon Bedrock |

## Model Resolution (`src/providers/resolver.ts`)

```typescript
resolveModel('openai:gpt-4o')           // Built-in provider
resolveModel('zai:glm-4')               // Custom provider (env vars)
resolveModel('large')                   // Alias (LM_MODEL_LARGE env var)
resolveModel(openai('gpt-4o'))          // Direct LanguageModel instance
```

The `model` parameter in `runPrompt` accepts two formats:
1. **String format**: `provider:model_id` — provider auto-resolved from AI SDK
2. **Direct provider**: An AI SDK `LanguageModelV1` implementation

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// String format
{ model: 'openai:gpt-4o' }
{ model: 'anthropic:claude-3-5-sonnet-20241022' }
{ model: 'google:gemini-1.5-pro' }

// Direct provider
{ model: openai('gpt-4o') }
{ model: anthropic('claude-3-5-sonnet-20241022') }
```

## Custom Providers (`src/providers/custom.ts`)

Environment variable pattern for any OpenAI-compatible API:

```bash
{NAME}_API_KEY=your-key
{NAME}_API_BASE=https://api.example.com/v1
{NAME}_API_TYPE=openai  # Required to activate
{NAME}_API_NAME=display-name  # Optional display name
```

Then use: `{ model: '{name}:model-id' }`

### GitHub Models API (for CI/CD)

```bash
GITHUB_MODELS_API_KEY=your-github-token
GITHUB_MODELS_API_BASE=https://models.inference.ai.azure.com
GITHUB_MODELS_API_TYPE=openai
```

Usage: `{ model: 'github:gpt-4o-mini' }`

See `docs/GITHUB_MODELS_CI.md` for CI/CD setup instructions.

## Model Aliases

```bash
LM_MODEL_LARGE=openai:gpt-4o
LM_MODEL_FAST=openai:gpt-4o-mini
LM_MODEL_SMART=anthropic:claude-3-opus-20240229
```

Then use: `{ model: 'large' }`, `{ model: 'fast' }`, `{ model: 'smart' }`

## Adding a New Provider

1. Create `src/providers/{name}.ts`:
```typescript
import { create{Name} } from '@ai-sdk/{name}';

export interface {Name}Config { ... }

export function create{Name}Provider(config?: {Name}Config) {
  return create{Name}({ ... });
}

export const {name} = create{Name}Provider();
export const {Name}Models = { ... } as const;
```

2. Export from `src/providers/index.ts`
3. Add to `providers` registry object
4. Add tests
