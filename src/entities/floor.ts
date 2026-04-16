import type { ClassicFloorData } from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** ClassicFloor model representing a level within a building. */
export class ClassicFloor extends BaseModel {
  public buildingId: number

  public readonly modelKind = 'floor'

  public constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: ClassicFloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }

  public [syncModel]({
    BuildingId: buildingId,
    Name: name,
  }: ClassicFloorData): void {
    this.name = name
    this.buildingId = buildingId
  }
}
