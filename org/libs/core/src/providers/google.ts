import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { defineProvider, BaseProviderConfig } from './factory';

export interface GoogleConfig extends BaseProviderConfig {}

const module = defineProvider({
  name: 'google',
  envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  sdkFactory: createGoogleGenerativeAI,
  models: {
    GEMINI_1_5_PRO: 'gemini-1.5-pro',
    GEMINI_1_5_PRO_LATEST: 'gemini-1.5-pro-latest',
    GEMINI_1_5_FLASH: 'gemini-1.5-flash',
    GEMINI_1_5_FLASH_LATEST: 'gemini-1.5-flash-latest',
    GEMINI_PRO: 'gemini-pro',
    GEMINI_PRO_VISION: 'gemini-pro-vision',
  },
});

export const createGoogleProvider = module.createProvider;
export const google = module.provider;
export const GoogleModels = module.models;
export type GoogleModel = typeof GoogleModels[keyof typeof GoogleModels];
