import type { ClassicAreaData, ClassicAreaDataAny } from '../types/index.ts'
import { BaseModel } from './base.ts'

/** ClassicArea model representing a zone within a building or floor. */
export class ClassicArea<
  T extends number | null = number | null,
> extends BaseModel {
  public buildingId: number

  public floorId: number | null

  public readonly modelKind = 'area'

  public constructor({
    BuildingId: buildingId,
    FloorId: floorId,
    ID: id,
    Name: name,
  }: ClassicAreaData<T> | ClassicAreaDataAny) {
    super({ id, name })
    this.buildingId = buildingId
    this.floorId = floorId
  }
}

/**
 * Apply a sync update from upstream area data onto an existing model.
 *
 * Module-internal: not re-exported from `entities/index.ts` so consumers
 * keep using the registry-driven sync flow rather than mutating models
 * directly.
 * @param model - The model to mutate in-place.
 * @param data - The fresh area data from the upstream API.
 * @param data.BuildingId - Owning building identifier.
 * @param data.FloorId - Owning floor identifier (or `null` if directly under the building).
 * @param data.Name - Updated area display name.
 */
export const syncArea = <T extends number | null>(
  model: ClassicArea<T>,
  {
    BuildingId: buildingId,
    FloorId: floorId,
    Name: name,
  }: ClassicAreaData<T> | ClassicAreaDataAny,
): void => {
  model.name = name
  model.buildingId = buildingId
  model.floorId = floorId
}
