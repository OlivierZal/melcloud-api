import { APIError } from './base.ts'

/**
 * Thrown when a facade attempts to resolve its underlying registry entity
 * by id and finds nothing — typically because the registry was rebuilt
 * (re-login, re-sync, or upstream rename/deletion) and the entity no
 * longer exists under the previously known id.
 *
 * Recovery: invalidate any cached facade reference held by the consumer
 * and re-resolve the entity through the appropriate manager.
 * @example
 * ```ts
 * try {
 *   await facade.fetch()
 * } catch (error) {
 *   if (error instanceof EntityNotFoundError) {
 *     this.cachedFacade = undefined
 *     return
 *   }
 *   throw error
 * }
 * ```
 */
export class EntityNotFoundError extends APIError {
  public override readonly name = 'EntityNotFoundError'

  /** Registry table the lookup was performed against (e.g. `'DeviceLocation'`). */
  public readonly tableName: string

  /** Id that could not be resolved in the registry. */
  public readonly entityId: number

  public constructor(
    tableName: string,
    entityId: number,
    options?: { cause?: unknown },
  ) {
    super(`${tableName} with id ${String(entityId)} not found`, options)
    this.tableName = tableName
    this.entityId = entityId
  }
}
