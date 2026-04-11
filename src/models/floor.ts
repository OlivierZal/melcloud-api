import type { FloorData } from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** Floor model representing a level within a building. */
export class Floor extends BaseModel {
  public buildingId: number

  public readonly modelKind = 'floor'

  public constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: FloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }

  public [syncModel]({ BuildingId: buildingId, Name: name }: FloorData): void {
    this.name = name
    this.buildingId = buildingId
  }
}
