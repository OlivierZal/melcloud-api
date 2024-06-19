import type { BuildingData, BuildingSettings } from '../types'
import DeviceModel, { type DeviceModelAny } from './device'
import BaseModel from './base'
import type { IBuildingModel } from './interfaces'

export default class BuildingModel extends BaseModel implements IBuildingModel {
  public static readonly buildings = new Map<number, BuildingModel>()

  public readonly settings: BuildingSettings

  private constructor({ Name: name, ID: id, ...settings }: BuildingData) {
    super({ id, name })
    this.settings = settings
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(
      ({ buildingId }) => buildingId === this.id,
    )
  }

  public static getAll(): BuildingModel[] {
    return Array.from(this.buildings.values())
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.buildings.get(id)
  }

  public static getByName(buildingName: string): BuildingModel | undefined {
    return this.getAll().find(({ name }) => name === buildingName)
  }

  public static upsert(data: BuildingData): void {
    this.buildings.set(data.ID, new this(data))
  }
}
