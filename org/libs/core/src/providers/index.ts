/**
 * AI Provider Registry for @lmthing/repl
 *
 * Copied from org/libs/core/src/providers/ to avoid cross-package dependency.
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
 */
export async function getProvider(name: ProviderName) {
  return providerLoaders[name]();
}

/**
 * List all available provider names
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

/**
 * Provider errors
 */
export { ProviderError, ErrorCodes } from './errors';
