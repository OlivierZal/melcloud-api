import type {
  ClassicBuildingData,
  ClassicZoneSettings,
} from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** ClassicBuilding model holding zone settings and geographic location. */
export class ClassicBuilding extends BaseModel {
  public data: ClassicZoneSettings

  public location: number

  public readonly modelKind = 'building'

  public constructor({
    ID: id,
    Location: location,
    Name: name,
    ...data
  }: ClassicBuildingData) {
    super({ id, name })
    this.location = location
    this.data = data
  }

  public [syncModel]({
    Location: location,
    Name: name,
    ...data
  }: ClassicBuildingData): void {
    this.name = name
    this.location = location
    this.data = data
  }
}
