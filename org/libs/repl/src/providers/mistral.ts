import { createMistral } from '@ai-sdk/mistral';
import { defineProvider, BaseProviderConfig } from './factory';

export interface MistralConfig extends BaseProviderConfig {}

const module = defineProvider({
  name: 'mistral',
  envKey: 'MISTRAL_API_KEY',
  sdkFactory: createMistral,
  models: {
    LARGE_LATEST: 'mistral-large-latest',
    MEDIUM_LATEST: 'mistral-medium-latest',
    SMALL_LATEST: 'mistral-small-latest',
    TINY: 'mistral-tiny',
    CODESTRAL: 'codestral-latest',
    MIXTRAL_8X7B: 'open-mixtral-8x7b',
    MIXTRAL_8X22B: 'open-mixtral-8x22b',
  },
});

export const createMistralProvider = module.createProvider;
export const mistral = module.provider;
export const MistralModels = module.models;
export type MistralModel = typeof MistralModels[keyof typeof MistralModels];
