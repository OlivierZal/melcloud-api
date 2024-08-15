import type { BuildingData, BuildingSettings } from '../types'
import type { IBuildingModel } from './interfaces'

import AreaModel, { type AreaModelAny } from './area'
import BaseModel from './base'
import DeviceModel, { type DeviceModelAny } from './device'
import FloorModel from './floor'

export default class BuildingModel extends BaseModel implements IBuildingModel {
  static readonly #buildings = new Map<number, BuildingModel>()

  public readonly data: BuildingSettings

  private constructor({ ID: id, Name: name, ...data }: BuildingData) {
    super({ id, name })
    this.data = data
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
    return [...this.#buildings.values()]
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.#buildings.get(id)
  }

  public static getByName(name: string): BuildingModel | undefined {
    return this.getAll().find((model) => model.name === name)
  }

  public static upsert(building: BuildingData): void {
    this.#buildings.set(building.ID, new this(building))
  }
}
