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
 * @category Errors
 */
export class NoChangesError extends APIError {
  /**
   * Id of the entity the update targeted (device, zone, building, etc.).
   */
  public readonly entityId: number | string

  public override readonly name = 'NoChangesError'

  /**
   * Builds the error tagged with the id of the entity that was already
   * in the requested state.
   * @param entityId - Id of the targeted entity.
   * @param options - Optional bag carrying the underlying cause.
   * @param options.cause - Original error that triggered this one.
   */
  public constructor(entityId: number | string, options?: { cause?: unknown }) {
    super(`No changes for entity with id ${String(entityId)}`, options)
    this.entityId = entityId
  }
}

/**
 * Run a group-member update, counting a {@link NoChangesError} as
 * success: a device already matching the group state is fine by
 * definition, so zone group writes — and the group-of-one emulation —
 * are no-op tolerant.
 * @param update - The member update to run.
 * @throws {@link Error} the reason `update` rejects with, unless it is a
 *   {@link NoChangesError} (which counts as success).
 */
export const tolerateNoChanges = async (
  update: () => Promise<unknown>,
): Promise<void> => {
  try {
    await update()
  } catch (error) {
    if (!(error instanceof NoChangesError)) {
      throw error
    }
  }
}
