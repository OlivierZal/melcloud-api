import type { AreaData, AreaDataAny } from '../types/index.ts'

import { BaseModel } from './base.ts'

/** Area model representing a zone within a building or floor. */
export class AreaModel<
  T extends number | null = number | null,
> extends BaseModel {
  public readonly buildingId: number

  public readonly floorId: number | null

  public constructor({
    BuildingId: buildingId,
    FloorId: floorId,
    ID: id,
    Name: name,
  }: AreaData<T> | AreaDataAny) {
    super({ id, name })
    this.buildingId = buildingId
    this.floorId = floorId
  }
}
