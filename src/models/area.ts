import type { AreaData, AreaDataAny } from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** Area model representing a zone within a building or floor. */
export class Area<T extends number | null = number | null> extends BaseModel {
  public buildingId: number

  public floorId: number | null

  public readonly modelKind = 'area'

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

  public [syncModel]({
    BuildingId: buildingId,
    FloorId: floorId,
    Name: name,
  }: AreaData<T> | AreaDataAny): void {
    this.name = name
    this.buildingId = buildingId
    this.floorId = floorId
  }
}
