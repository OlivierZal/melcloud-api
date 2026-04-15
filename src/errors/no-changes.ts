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
 *   if (error instanceof NoChangesError) {
 *     return
 *   }
 *   throw error
 * }
 * ```
 */
export class NoChangesError extends APIError {
  public override readonly name = 'NoChangesError'

  /** Id of the entity the update targeted (device, zone, building, etc.). */
  public readonly entityId: number | string

  public constructor(entityId: number | string, options?: { cause?: unknown }) {
    super(`No changes for entity with id ${String(entityId)}`, options)
    this.entityId = entityId
  }
}
