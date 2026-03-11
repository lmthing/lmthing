import { LanguageModelV3 } from '@ai-sdk/provider';
import { getCustomProvider, isCustomProvider, listCustomProviders } from './custom';
import { ProviderError, ErrorCodes } from '../errors';

type BuiltInProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'azure'
  | 'groq'
  | 'cohere'
  | 'bedrock';

const BUILT_IN_PROVIDER_NAMES: BuiltInProviderName[] = [
  'openai',
  'anthropic',
  'google',
  'mistral',
  'azure',
  'groq',
  'cohere',
  'bedrock',
];

type ProviderFactory = (modelId: string) => LanguageModelV3;
const builtInProviderLoaders: Record<BuiltInProviderName, () => Promise<ProviderFactory>> = {
  openai: async () => (await import('./openai')).openai,
  anthropic: async () => (await import('./anthropic')).anthropic,
  google: async () => (await import('./google')).google,
  mistral: async () => (await import('./mistral')).mistral,
  azure: async () => (await import('./azure')).azure,
  groq: async () => (await import('./groq')).groq,
  cohere: async () => (await import('./cohere')).cohere,
  bedrock: async () => (await import('./bedrock')).bedrock,
};

function isBuiltInProvider(name: string): name is BuiltInProviderName {
  return Object.hasOwn(builtInProviderLoaders, name);
}

function createLazyBuiltInModel(providerName: BuiltInProviderName, modelId: string): LanguageModelV3 {
  let modelPromise: Promise<LanguageModelV3> | undefined;

  const getModel = async (): Promise<LanguageModelV3> => {
    if (!modelPromise) {
      modelPromise = builtInProviderLoaders[providerName]().then((provider) => provider(modelId));
    }
    return modelPromise;
  };

  return {
    specificationVersion: 'v3',
    provider: providerName,
    modelId,
    supportedUrls: getModel().then((model) => model.supportedUrls),
    doGenerate: async (options) => {
      const model = await getModel();
      return model.doGenerate(options);
    },
    doStream: async (options) => {
      const model = await getModel();
      return model.doStream(options);
    },
  };
}

/**
 * Resolves a model identifier to a LanguageModelV3 instance
 *
 * Supports built-in providers, custom OpenAI-compatible providers,
 * and model aliases configured via environment variables.
 *
 * @category Providers
 *
 * @param model - Either a LanguageModelV3 instance, a string in the format "provider:modelId", or an alias name
 * @returns A LanguageModelV3 instance
 * @throws Error if the provider is not found or the format is invalid
 *
 * @example
 * ```typescript
 * // Built-in providers
 * const model1 = resolveModel('openai:gpt-4o');
 * const model2 = resolveModel('anthropic:claude-3-5-sonnet-20241022');
 *
 * // Custom providers (configured via env vars)
 * const model3 = resolveModel('zai:gpt-4');
 * const model4 = resolveModel('openrouter:anthropic/claude-3.5-sonnet');
 *
 * // Model aliases (configured via LM_MODEL_* env vars)
 * // Set: LM_MODEL_LARGE=openai:gpt-4o
 * const model5 = resolveModel('large');
 *
 * // Direct model instance (passes through)
 * import { openai } from 'lmthing/providers';
 * const model6 = resolveModel(openai('gpt-4o'));
 * ```
 */
export function resolveModel(model: LanguageModelV3 | string): LanguageModelV3 {
  // If it's already a model instance, return it
  if (typeof model !== 'string') {
    return model;
  }

  // Check for model aliases first (strings without colons)
  // Model aliases are configured via LM_MODEL_* environment variables
  const colonIndex = model.indexOf(':');

  if (colonIndex === -1) {
    // No colon found - treat as an alias
    const aliasKey = `LM_MODEL_${model.toUpperCase()}`;
    const aliasValue = process.env[aliasKey];

    if (aliasValue) {
      // Recursively resolve the alias value (could be another alias or a provider:modelId)
      return resolveModel(aliasValue);
    }

    throw new ProviderError(
      `Model alias "${model}" not found. Please set the environment variable ${aliasKey} (e.g., ${aliasKey}=openai:gpt-4o)`,
      ErrorCodes.PROVIDER_NOT_CONFIGURED,
      { alias: model, envVar: aliasKey }
    );
  }

  // Parse the string format "provider:modelId"
  // Use indexOf to handle model IDs that contain colons (e.g., bedrock models like "anthropic.claude-3-5-sonnet-20241022-v2:0")
  const providerName = model.slice(0, colonIndex);
  const modelId = model.slice(colonIndex + 1);

  // Check built-in providers first (lazy-loaded)
  if (isBuiltInProvider(providerName)) {
    return createLazyBuiltInModel(providerName, modelId);
  }

  // Check custom providers
  if (isCustomProvider(providerName)) {
    const customProvider = getCustomProvider(providerName);
    if (customProvider) {
      return customProvider(modelId) as unknown as LanguageModelV3;
    }
  }

  // Provider not found
  const builtInProviders = BUILT_IN_PROVIDER_NAMES;
  const customProviders = listCustomProviders();
  const allProviders = [...builtInProviders, ...customProviders];

  throw new ProviderError(
    `Unknown provider: "${providerName}". Available providers: ${allProviders.join(', ')}`,
    ErrorCodes.UNKNOWN_PROVIDER,
    { provider: providerName, available: allProviders }
  );
}

/**
 * Type for model input - can be either a model instance or a string identifier
 *
 * @category Providers
 */
export type ModelInput = LanguageModelV3 | string;
