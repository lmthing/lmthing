import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * Custom Provider Configuration
 *
 * Allows creating custom OpenAI-compatible providers from environment variables.
 *
 * Environment variable format:
 * - {NAME}_API_KEY: API key for the provider
 * - {NAME}_API_BASE: Base URL for the API endpoint
 * - {NAME}_API_TYPE: Must be set to "openai" to identify as custom provider
 * - {NAME}_API_NAME: (Optional) Human-readable name for the provider
 */

export interface CustomProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  prefix: string;
}

/**
 * Scans environment variables for custom provider configurations
 */
export function scanCustomProviders(): CustomProviderConfig[] {
  const configs: CustomProviderConfig[] = [];
  const processedPrefixes = new Set<string>();

  for (const key in process.env) {
    const match = key.match(/^([A-Z0-9_]+)_API_KEY$/);
    if (match) {
      const name = match[1];

      if (processedPrefixes.has(name)) {
        continue;
      }

      const builtInPrefixes = ['OPENAI', 'ANTHROPIC', 'GOOGLE_GENERATIVE_AI', 'GOOGLE_VERTEX', 'MISTRAL', 'AZURE', 'GROQ', 'COHERE', 'AWS'];
      if (builtInPrefixes.includes(name)) {
        continue;
      }

      const apiType = process.env[`${name}_API_TYPE`];

      if (apiType !== 'openai') {
        continue;
      }

      const apiKey = process.env[key];
      const baseURL = process.env[`${name}_API_BASE`];
      const displayName = process.env[`${name}_API_NAME`] || name.toLowerCase();

      if (apiKey && baseURL) {
        configs.push({
          name: displayName,
          apiKey,
          baseURL,
          prefix: name,
        });
        processedPrefixes.add(name);
      }
    }
  }

  return configs;
}

/**
 * Creates a provider instance from a custom configuration
 */
export function createCustomProvider(config: CustomProviderConfig) {
  return createOpenAICompatible({
    name: config.name,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    queryParams: {
      'api-version': '1.0.0',
    },

  });
}

/**
 * Registry of custom providers loaded from environment variables
 */
let customProvidersRegistry: Map<string, ReturnType<typeof createOpenAICompatible>> | null = null;

/**
 * Gets or initializes the custom providers registry
 */
export function getCustomProviders(): Map<string, ReturnType<typeof createOpenAICompatible>> {
  if (!customProvidersRegistry) {
    customProvidersRegistry = new Map();
    const configs = scanCustomProviders();

    for (const config of configs) {
      const provider = createCustomProvider(config);
      customProvidersRegistry.set(config.name, provider);
    }
  }

  return customProvidersRegistry;
}

/**
 * Checks if a provider name is a custom provider
 */
export function isCustomProvider(name: string): boolean {
  return getCustomProviders().has(name);
}

/**
 * Gets a custom provider by name
 */
export function getCustomProvider(name: string) {
  return getCustomProviders().get(name);
}

/**
 * Lists all available custom provider names
 */
export function listCustomProviders(): string[] {
  return Array.from(getCustomProviders().keys());
}

/**
 * Resets the custom providers registry (for testing)
 * @internal
 */
export function resetCustomProvidersRegistry(): void {
  customProvidersRegistry = null;
}
