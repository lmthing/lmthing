/**
 * Generic provider factory to reduce boilerplate across provider modules.
 */

export interface BaseProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

export interface ProviderDefinition<
  TConfig = BaseProviderConfig,
  TModels extends Record<string, string> = Record<string, string>
> {
  /** Name of the provider (e.g., 'mistral', 'openai') */
  name: string;
  /** Environment variable name for the API key (e.g., 'MISTRAL_API_KEY') */
  envKey: string;
  /** The AI SDK factory function (e.g., createMistral from @ai-sdk/mistral) */
  sdkFactory: (config: any) => any;
  /** Map config to SDK-specific format (for providers with extra options) */
  mapConfig?: (config: TConfig) => any;
  /** Model ID constants */
  models: TModels;
}

export interface ProviderModule<
  TConfig = BaseProviderConfig,
  TModels extends Record<string, string> = Record<string, string>
> {
  /** Create a configured provider instance */
  createProvider: (config?: TConfig) => ReturnType<any>;
  /** Default provider instance using env vars */
  provider: ReturnType<any>;
  /** Model ID constants */
  models: TModels;
}

function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  let result = value.trim();
  let quoteChar: '"' | "'" | null = null;

  for (let i = 0; i < result.length; i += 1) {
    const char = result[i];

    if ((char === '"' || char === "'")) {
      if (!quoteChar) {
        quoteChar = char;
      } else if (quoteChar === char) {
        quoteChar = null;
      }
      continue;
    }

    if (char === '#' && !quoteChar) {
      const prevChar = i > 0 ? result[i - 1] : '';
      if (i === 0 || /\s/.test(prevChar)) {
        result = result.slice(0, i).trim();
        break;
      }
    }
  }

  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1).trim();
  }

  return result;
}

/**
 * Create a provider module with standard exports.
 */
export function defineProvider<
  TConfig = BaseProviderConfig,
  TModels extends Record<string, string> = Record<string, string>
>(
  definition: ProviderDefinition<TConfig, TModels>
): ProviderModule<TConfig, TModels> {
  const { name, envKey, sdkFactory, mapConfig, models } = definition;

  const createProvider = (config?: TConfig) => {
    const baseConfig = {
      apiKey: (config as any)?.apiKey || sanitizeEnvValue(process.env[envKey]),
      baseURL: (config as any)?.baseURL,
    };

    const finalConfig = mapConfig
      ? mapConfig({ ...baseConfig, ...config } as TConfig)
      : baseConfig;

    return sdkFactory(finalConfig);
  };

  return {
    createProvider,
    provider: createProvider(),
    models,
  };
}
