import type {
  ClassicBuildingData,
  ClassicZoneSettings,
} from '../types/index.ts'
import { BaseModel } from './base.ts'

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
}

/**
 * Apply a sync update from upstream building data onto an existing model.
 *
 * Module-internal: not re-exported from `entities/index.ts`.
 * @param model - The model to mutate in-place.
 * @param data - The fresh building data from the upstream API.
 * @param data.Location - Geographic location identifier.
 * @param data.Name - Updated building display name.
 */
export const syncBuilding = (
  model: ClassicBuilding,
  { Location: location, Name: name, ...data }: ClassicBuildingData,
): void => {
  model.name = name
  model.location = location
  model.data = data
}
