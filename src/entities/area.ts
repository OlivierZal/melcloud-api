import type { ClassicAreaData, ClassicAreaDataAny } from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

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

  public [syncModel]({
    BuildingId: buildingId,
    FloorId: floorId,
    Name: name,
  }: ClassicAreaData<T> | ClassicAreaDataAny): void {
    this.name = name
    this.buildingId = buildingId
    this.floorId = floorId
  }
}
