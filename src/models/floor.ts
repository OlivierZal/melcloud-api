import type { FloorData } from '../types/index.ts'

import { BaseModel } from './base.ts'

/** Floor model representing a level within a building. */
export class FloorModel extends BaseModel {
  public buildingId: number

  public constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: FloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }

  public sync({ BuildingId: buildingId, Name: name }: FloorData): void {
    this.name = name
    this.buildingId = buildingId
  }
}
