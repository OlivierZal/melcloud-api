import AreaModel, { type AreaModelAny } from './area'
import type { BuildingData, BuildingSettings } from '../types'
import DeviceModel, { type DeviceModelAny } from './device'
import BaseModel from './base'
import FloorModel from './floor'
import type { IBuildingModel } from './interfaces'

export default class BuildingModel extends BaseModel implements IBuildingModel {
  static readonly #buildings = new Map<number, BuildingModel>()

  public readonly settings: BuildingSettings

  private constructor({ Name: name, ID: id, ...settings }: BuildingData) {
    super({ id, name })
    this.settings = settings
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): AreaModelAny[] {
    return AreaModel.getByBuildingId(this.id)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getByBuildingId(this.id)
  }

  public get floorIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get floors(): FloorModel[] {
    return FloorModel.getByBuildingId(this.id)
  }

  public static getAll(): BuildingModel[] {
    return Array.from(this.#buildings.values())
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.#buildings.get(id)
  }

  public static getByName(name: string): BuildingModel | undefined {
    return this.getAll().find((model) => model.name === name)
  }

  public static upsert(data: BuildingData): void {
    this.#buildings.set(data.ID, new this(data))
  }
}
