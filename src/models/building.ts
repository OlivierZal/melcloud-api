import type { BuildingData, ZoneSettings } from '../types/index.ts'

import { BaseModel } from './base.ts'

/** Building model holding zone settings and geographic location. */
export class BuildingModel extends BaseModel {
  public readonly data: ZoneSettings

  public readonly location: number

  public constructor({
    ID: id,
    Location: location,
    Name: name,
    ...data
  }: BuildingData) {
    super({ id, name })
    this.location = location
    this.data = data
  }
}
