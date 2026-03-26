import type { BuildingData, ZoneSettings } from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** Building model holding zone settings and geographic location. */
export class BuildingModel extends BaseModel {
  public data: ZoneSettings

  public location: number

  public readonly modelKind = 'building'

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

  public [syncModel]({
    Location: location,
    Name: name,
    ...data
  }: BuildingData): void {
    this.name = name
    this.location = location
    this.data = data
  }
}
