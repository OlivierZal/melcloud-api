import type { ClassicFloorData } from '../types/index.ts'
import { BaseModel } from './base.ts'

/**
 * ClassicFloor model representing a level within a building.
 * @category Entities
 */
export class ClassicFloor extends BaseModel {
  public buildingId: number

  public readonly modelKind = 'floor'

  /**
   * Builds a floor model from a wire-format {@link ClassicFloorData} entry.
   * @param root0 - Wire-format floor data.
   * @param root0.BuildingId - Owning building identifier.
   * @param root0.ID - Floor identifier.
   * @param root0.Name - Floor display name.
   */
  public constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: ClassicFloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }
}

/**
 * Apply a sync update from upstream floor data onto an existing model.
 *
 * Module-internal: not re-exported from `entities/index.ts`.
 * @param model - The model to mutate in-place.
 * @param data - The fresh floor data from the upstream API.
 * @param data.BuildingId - Owning building identifier.
 * @param data.Name - Updated floor display name.
 */
export const syncFloor = (
  model: ClassicFloor,
  { BuildingId: buildingId, Name: name }: ClassicFloorData,
): void => {
  model.name = name
  model.buildingId = buildingId
}
