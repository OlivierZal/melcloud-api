import { BaseModel } from './base.js'

import type { BuildingData, ZoneSettings } from '../types/index.js'

import type { AreaModel, AreaModelAny } from './area.js'
import type { DeviceModel, DeviceModelAny } from './device.js'
import type { FloorModel } from './floor.js'
import type { IBuildingModel } from './interfaces.js'

export class BuildingModel extends BaseModel implements IBuildingModel {
  static readonly #instances = new Map<number, BuildingModel>()

  static #areaModel: typeof AreaModel

  static #deviceModel: typeof DeviceModel

  static #floorModel: typeof FloorModel

  public readonly data: ZoneSettings

  private constructor({ ID: id, Name: name, ...data }: BuildingData) {
    super({ id, name })
    this.data = data
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): AreaModelAny[] {
    return BuildingModel.#areaModel.getByBuildingId(this.id)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return BuildingModel.#deviceModel.getByBuildingId(this.id)
  }

  public get floorIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get floors(): FloorModel[] {
    return BuildingModel.#floorModel.getByBuildingId(this.id)
  }

  public static getAll(): BuildingModel[] {
    return [...this.#instances.values()]
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): BuildingModel | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static setAreaModel(model: typeof AreaModel): void {
    this.#areaModel = model
  }

  public static setDeviceModel(model: typeof DeviceModel): void {
    this.#deviceModel = model
  }

  public static setFloorModel(model: typeof FloorModel): void {
    this.#floorModel = model
  }

  public static upsert(building: BuildingData): void {
    this.#instances.set(building.ID, new this(building))
  }
}
