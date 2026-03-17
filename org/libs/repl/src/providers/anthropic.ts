import { createAnthropic } from '@ai-sdk/anthropic';
import { defineProvider, BaseProviderConfig } from './factory';

export interface AnthropicConfig extends BaseProviderConfig {}

const module = defineProvider({
  name: 'anthropic',
  envKey: 'ANTHROPIC_API_KEY',
  sdkFactory: createAnthropic,
  models: {
    CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
    CLAUDE_3_5_SONNET_LEGACY: 'claude-3-5-sonnet-20240620',
    CLAUDE_3_OPUS: 'claude-3-opus-20240229',
    CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
    CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  },
});

export const createAnthropicProvider = module.createProvider;
export const anthropic = module.provider;
export const AnthropicModels = module.models;
export type AnthropicModel = typeof AnthropicModels[keyof typeof AnthropicModels];
