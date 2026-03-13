const noop = () => {
  throw new Error('AI SDK provider not available in browser environment')
}

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
