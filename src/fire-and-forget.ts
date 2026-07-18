import type { Logger } from './api/types.ts'

/**
 * The one sanctioned fire-and-forget seam: detach already-started work
 * from the caller's critical path, logging a rejection instead of
 * propagating it.
 * @param promise - The already-started work to detach.
 * @param logger - Sink for a rejection.
 * @param message - Context line prefixed to the logged rejection.
 */
export const fireAndForget = (
  promise: Promise<unknown>,
  logger: Logger,
  message: string,
): void => {
  // eslint-disable-next-line unicorn/prefer-await -- the single fire-and-forget seam: rejections are logged, never propagated
  promise.catch((error: unknown) => {
    logger.error(message, error)
  })
}
