import { createCohere } from '@ai-sdk/cohere';
import { defineProvider, BaseProviderConfig } from './factory';

export interface CohereConfig extends BaseProviderConfig {}

const module = defineProvider({
  name: 'cohere',
  envKey: 'COHERE_API_KEY',
  sdkFactory: createCohere,
  models: {
    COMMAND_R_PLUS: 'command-r-plus',
    COMMAND_R: 'command-r',
    COMMAND: 'command',
    COMMAND_LIGHT: 'command-light',
  },
});

export const createCohereProvider = module.createProvider;
export const cohere = module.provider;
export const CohereModels = module.models;
export type CohereModel = typeof CohereModels[keyof typeof CohereModels];
