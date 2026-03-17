export interface CatalogFunction {
  /** Function name — becomes a global in the sandbox */
  name: string
  /** Human-readable description — injected into system prompt */
  description: string
  /** TypeScript signature string for the system prompt */
  signature: string
  /** The actual implementation */
  fn: (...args: unknown[]) => unknown
}

export interface CatalogModule {
  /** Module name (e.g., "fs", "fetch") */
  id: string
  /** One-line description */
  description: string
  /** Functions provided by this module */
  functions: CatalogFunction[]
}
