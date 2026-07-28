import type { ClassicFailureData, ClassicSuccessData } from '../types/index.ts'
import { APIError } from './base.ts'

/**
 * Thrown when MELCloud Classic accepts a mutation request but rejects its
 * content, reporting per-attribute messages (`AttributeErrors`). The
 * facades convert that wire union into this typed throw, so both dialects
 * share one `Promise<void>` outcome contract for every mutation.
 * @category Errors
 */
export class UpdateRejectedError extends APIError {
  /** Per-attribute rejection messages as reported by the wire. */
  public readonly attributeErrors: Record<string, readonly string[]>

  public override readonly name = 'UpdateRejectedError'

  /**
   * Builds the error from the wire's per-attribute messages; the message
   * flattens them into a human-readable summary.
   * @param attributeErrors - Per-attribute rejection messages.
   * @param options - Optional bag carrying the underlying cause.
   * @param options.cause - Original error that triggered this one.
   */
  public constructor(
    attributeErrors: Record<string, readonly string[]>,
    options?: { cause?: unknown },
  ) {
    super(
      Object.entries(attributeErrors)
        .map(([attribute, messages]) => `${attribute}: ${messages.join(', ')}`)
        .join('; '),
      options,
    )
    this.attributeErrors = attributeErrors
  }
}

/**
 * Converts the Classic mutation wire union into the cross-dialect
 * throw-on-failure contract.
 * @param data - Wire outcome of a Classic mutation.
 * @throws UpdateRejectedError when the wire reports `Success: false`.
 */
export const assertUpdateAccepted = (
  data: ClassicFailureData | ClassicSuccessData,
): void => {
  if (!data.Success) {
    throw new UpdateRejectedError(data.AttributeErrors)
  }
}
