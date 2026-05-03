/**
 * Base class for all errors thrown by this SDK.
 */
export abstract class APIError extends Error {
  public override readonly name: string = 'APIError'

  /**
   * Builds an SDK error.
   * @param message - Human-readable error description.
   * @param options - Optional bag carrying the underlying cause.
   * @param options.cause - Original error that triggered this one.
   */
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}

/**
 * User-defined type guard for {@link APIError} and its subclasses.
 * @param error - The value to test.
 * @returns `true` if `error` is a {@link APIError} instance.
 */
export const isAPIError = (error: unknown): error is APIError =>
  error instanceof APIError
