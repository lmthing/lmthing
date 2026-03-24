/**
 * Provider-specific error classes for @lmthing/repl.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

export const ErrorCodes = {
  UNKNOWN_PROVIDER: 'UNKNOWN_PROVIDER',
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_API_BASE: 'MISSING_API_BASE',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
} as const;
