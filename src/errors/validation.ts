import { APIError } from './base.ts'

/**
 * Thrown when a runtime validator (Zod, in this SDK) rejects an
 * upstream response. The `context` field surfaces which boundary the
 * payload came from (e.g. `'BFF /context'`, `'ClientLogin3'`,
 * `'OIDC token endpoint'`) so consumer dashboards can group drift
 * alerts without parsing the message string.
 *
 * The underlying `ZodError` (or any other validator error) is attached
 * through the standard `cause` chain.
 */
export class ValidationError extends APIError {
  public readonly context: string

  public override readonly name = 'ValidationError'

  /**
   * Builds the error from the validator's message, the boundary
   * `context` label, and (typically) the underlying `ZodError` as the cause.
   * @param message - Human-readable error description.
   * @param options - Boundary label plus optional cause.
   * @param options.context - Boundary the rejected payload came from.
   * @param options.cause - Original error (typically a `ZodError`).
   */
  public constructor(
    message: string,
    options: { context: string; cause?: unknown },
  ) {
    const { cause, context } = options
    super(message, { cause })
    this.context = context
  }
}
