/**
 * AI Provider Registry
 *
 * This module provides a centralized registry for all available AI providers.
 * Each provider can be imported individually or accessed through the registry.
 *
 * @module providers
 */

// // OpenAI
// export {
//   openai,
//   createOpenAIProvider,
//   OpenAIModels,
//   type OpenAIConfig,
//   type OpenAIModel,
// } from './openai';

// // Anthropic
// export {
//   anthropic,
//   createAnthropicProvider,
//   AnthropicModels,
//   type AnthropicConfig,
//   type AnthropicModel,
// } from './anthropic';

// // Google Generative AI
// export {
//   google,
//   createGoogleProvider,
//   GoogleModels,
//   type GoogleConfig,
//   type GoogleModel,
// } from './google';

// // Mistral
// export {
//   mistral,
//   createMistralProvider,
//   MistralModels,
//   type MistralConfig,
//   type MistralModel,
// } from './mistral';

// // Azure OpenAI
// export {
//   azure,
//   createAzureProvider,
//   type AzureConfig,
// } from './azure';

// // Groq
// export {
//   groq,
//   createGroqProvider,
//   GroqModels,
//   type GroqConfig,
//   type GroqModel,
// } from './groq';

// // Cohere
// export {
//   cohere,
//   createCohereProvider,
//   CohereModels,
//   type CohereConfig,
//   type CohereModel,
// } from './cohere';

// // Amazon Bedrock
// export {
//   bedrock,
//   createBedrockProvider,
//   BedrockModels,
//   type BedrockConfig,
//   type BedrockModel,
// } from './bedrock';

// // Google Vertex AI
// export {
//   vertex,
//   createVertexProvider,
//   VertexModels,
//   type VertexConfig,
//   type VertexModel,
// } from './vertex';

// import { openai } from './openai';
// import { anthropic } from './anthropic';
// import { google } from './google';
// import { mistral } from './mistral';
// import { azure } from './azure';
// import { groq } from './groq';
// import { cohere } from './cohere';
// import { bedrock } from './bedrock';
// import { vertex } from './vertex';

/**
 * Provider Registry
 *
 * Central registry of all available providers
 */
// export const providers = {
//   openai,
//   anthropic,
//   google,
//   mistral,
//   azure,
//   groq,
//   cohere,
//   bedrock,
//   vertex,
// } as const;

/**
 * Provider type definition
 */
export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'azure'
  | 'groq'
  | 'cohere'
  | 'bedrock';

const providerLoaders: Record<ProviderName, () => Promise<any>> = {
  openai: () => import('./openai').then((m) => m.openai),
  anthropic: () => import('./anthropic').then((m) => m.anthropic),
  google: () => import('./google').then((m) => m.google),
  mistral: () => import('./mistral').then((m) => m.mistral),
  azure: () => import('./azure').then((m) => m.azure),
  groq: () => import('./groq').then((m) => m.groq),
  cohere: () => import('./cohere').then((m) => m.cohere),
  bedrock: () => import('./bedrock').then((m) => m.bedrock),
};

/**
 * Get a provider by name (dynamically imported)
 *
 * @param name - The provider name
 * @returns A promise resolving to the provider instance
 *
 * @example
 * ```typescript
 * import { getProvider } from 'lmthing/providers';
 *
 * const openai = await getProvider('openai');
 * const model = openai('gpt-4o');
 * ```
 */
export async function getProvider(name: ProviderName) {
  return providerLoaders[name]();
}

/**
 * List all available provider names
 *
 * @returns Array of provider names
 */
export function listProviders(): ProviderName[] {
  return Object.keys(providerLoaders) as ProviderName[];
}

/**
 * Model resolution utilities
 */
export { resolveModel, type ModelInput } from './resolver';

/**
 * Custom provider utilities
 */
export {
  scanCustomProviders,
  createCustomProvider,
  getCustomProviders,
  getCustomProvider,
  isCustomProvider,
  listCustomProviders,
  type CustomProviderConfig,
} from './custom';
