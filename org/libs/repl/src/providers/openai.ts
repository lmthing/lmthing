import { createOpenAI } from '@ai-sdk/openai';
import { defineProvider, BaseProviderConfig } from './factory';

export interface OpenAIConfig extends BaseProviderConfig {
  organization?: string;
  project?: string;
}

const OpenAIModelsObj = {
  GPT4O: 'gpt-4o',
  GPT4O_MINI: 'gpt-4o-mini',
  GPT4_TURBO: 'gpt-4-turbo',
  GPT4: 'gpt-4',
  GPT35_TURBO: 'gpt-3.5-turbo',
  O1_PREVIEW: 'o1-preview',
  O1_MINI: 'o1-mini',
} as const;

const module = defineProvider<OpenAIConfig, typeof OpenAIModelsObj>({
  name: 'openai',
  envKey: 'OPENAI_API_KEY',
  sdkFactory: createOpenAI,
  mapConfig: (config) => ({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    organization: config.organization,
    project: config.project,
  }),
  models: OpenAIModelsObj,
});

export const createOpenAIProvider = module.createProvider;
export const openai = module.provider;
export const OpenAIModels = OpenAIModelsObj;
export type OpenAIModel = typeof OpenAIModels[keyof typeof OpenAIModels];
