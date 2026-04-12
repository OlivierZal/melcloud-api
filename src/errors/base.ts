/**
 * Base class for all errors thrown by this SDK.
 */
export abstract class MelCloudError extends Error {
  public override readonly name: string = 'MelCloudError'

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}

/**
 * User-defined type guard for {@link MelCloudError} and its subclasses.
 * @param error - The value to test.
 * @returns `true` if `error` is a {@link MelCloudError} instance.
 */
export const isMelCloudError = (error: unknown): error is MelCloudError =>
  error instanceof MelCloudError
