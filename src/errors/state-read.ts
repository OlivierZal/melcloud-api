import type { ApiRequestError } from '../types/index.ts'
import { APIError } from './base.ts'

/**
 * Thrown when a Classic write cannot read the unit's live state first.
 * The Classic set endpoints apply the WHOLE body they receive —
 * `EffectiveFlags` is decorative, and a partial body zero-fills the
 * fields it omits (live-probed 2026-09-05) — so every write posts the
 * full state, merged onto a `/Device/Get` read taken immediately
 * before it rather than onto the last sync's snapshot, which could be
 * a whole sync interval old and re-imposed every field another writer
 * had changed since. When that read fails the write is refused rather
 * than sent from the snapshot: a rollback is worse than a retry.
 *
 * Recovery: retry once the read's failure class clears — `failure.kind`
 * says which (`network`/`server` are transient, `unauthorized` needs a
 * session, `rate-limited` waits out its window).
 * @example
 * ```ts
 * try {
 *   await facade.updateValues({ SetTemperature: 21 })
 * } catch (error) {
 *   if (error instanceof StateReadError) {
 *     scheduleRetry(error.failure.kind)
 *     return
 *   }
 *   throw error
 * }
 * ```
 * @category Errors
 */
export class StateReadError extends APIError {
  /**
   * Id of the device whose live state could not be read.
   */
  public readonly entityId: number | string

  /**
   * The classified read failure, the same {@link ApiRequestError}
   * variant `getValues` answers on its own.
   */
  public readonly failure: ApiRequestError

  public override readonly name = 'StateReadError'

  /**
   * Builds the error from the device id and the classified read
   * failure; the failure's own underlying error, when it carries one,
   * rides the standard `cause` chain.
   * @param entityId - Id of the device the write targeted.
   * @param options - The read failure.
   * @param options.failure - Classified failure of the live read.
   */
  public constructor(
    entityId: number | string,
    options: { failure: ApiRequestError },
  ) {
    const { failure } = options
    super(
      `Could not read the live state of device with id ${String(entityId)} before writing`,
      'cause' in failure ? { cause: failure.cause } : undefined,
    )
    this.entityId = entityId
    this.failure = failure
  }
}
