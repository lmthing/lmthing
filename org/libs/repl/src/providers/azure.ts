import { createAzure } from '@ai-sdk/azure';
import { defineProvider, BaseProviderConfig } from './factory';

export interface AzureConfig extends BaseProviderConfig {
  resourceName?: string;
}

const module = defineProvider<AzureConfig, {}>({
  name: 'azure',
  envKey: 'AZURE_API_KEY',
  sdkFactory: createAzure,
  mapConfig: (config) => ({
    apiKey: config.apiKey,
    resourceName: config.resourceName || process.env.AZURE_RESOURCE_NAME,
    baseURL: config.baseURL,
  }),
  models: {},
});

export const createAzureProvider = module.createProvider;
export const azure = module.provider;
