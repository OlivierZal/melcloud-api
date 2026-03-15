import type { FloorData } from '../types/index.ts'

import { BaseModel } from './base.ts'

/** Floor model representing a level within a building. */
export class FloorModel extends BaseModel {
  public readonly buildingId: number

  public constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: FloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }
}
