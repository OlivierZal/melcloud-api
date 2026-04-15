import { APIError } from './base.ts'

/**
 * Thrown when an `update*` call is made with no data to apply — either
 * the payload is empty, or every value already matches the current state.
 *
 * Recovery: skip the call when the intended values are already in place,
 * or validate the payload before dispatching.
 * @example
 * ```ts
 * try {
 *   await facade.updateValues({ setTemperature: 21 })
 * } catch (error) {
 *   if (error instanceof NoDataToUpdateError) {
 *     return
 *   }
 *   throw error
 * }
 * ```
 */
export class NoDataToUpdateError extends APIError {
  public override readonly name = 'NoDataToUpdateError'

  /** Id of the entity the update targeted (device, zone, building, etc.). */
  public readonly entityId: number | string

  public constructor(
    entityId: number | string,
    options?: { cause?: unknown },
  ) {
    super(`No data to update for entity with id ${String(entityId)}`, options)
    this.entityId = entityId
  }
}
