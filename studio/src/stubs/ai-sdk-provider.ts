// Stub for @ai-sdk/* provider packages that are not needed in the browser.
// The core lib imports these for server-side model resolution, but the studio
// only needs the types and never actually invokes provider constructors.

const noop = () => {
  throw new Error('AI SDK provider not available in browser environment')
}

// Each provider SDK exports a createXxx factory function
export const createOpenAI = noop
export const createAnthropic = noop
export const createGoogleGenerativeAI = noop
export const createMistral = noop
export const createAzure = noop
export const createGroq = noop
export const createCohere = noop
export const createAmazonBedrock = noop
export const createOpenAICompatible = noop

export default noop
