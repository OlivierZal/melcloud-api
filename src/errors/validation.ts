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

  public constructor(
    message: string,
    options: { context: string; cause?: unknown },
  ) {
    const { cause, context } = options
    super(message, { cause })
    this.context = context
  }
}
