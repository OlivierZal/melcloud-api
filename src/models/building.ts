import type { BuildingData, ZoneSettings } from '../types/common.ts'

import type { AreaModel } from './area.ts'
import type { DeviceModel } from './device.ts'
import type { FloorModel } from './floor.ts'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
} from './interfaces.ts'

import { BaseModel } from './base.ts'

export class BuildingModel extends BaseModel implements IBuildingModel {
  static #areaModel: typeof AreaModel

  static #deviceModel: typeof DeviceModel

  static #floorModel: typeof FloorModel

  static #instances = new Map<number, IBuildingModel>()

  public readonly data: ZoneSettings

  public readonly location: number

  private constructor({
    ID: id,
    Location: location,
    Name: name,
    ...data
  }: BuildingData) {
    super({ id, name })
    this.location = location
    this.data = data
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): IAreaModel[] {
    return BuildingModel.#areaModel.getByBuildingId(this.id)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): IDeviceModelAny[] {
    return BuildingModel.#deviceModel.getByBuildingId(this.id)
  }

  public get floorIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get floors(): IFloorModel[] {
    return BuildingModel.#floorModel.getByBuildingId(this.id)
  }

  public static getAll(): IBuildingModel[] {
    return [...this.#instances.values()]
  }

  public static getById(id: number): IBuildingModel | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): IBuildingModel | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static setModels({
    areaModel,
    deviceModel,
    floorModel,
  }: {
    areaModel: typeof AreaModel
    deviceModel: typeof DeviceModel
    floorModel: typeof FloorModel
  }): void {
    this.#areaModel = areaModel
    this.#deviceModel = deviceModel
    this.#floorModel = floorModel
  }

  public static sync(buildings: BuildingData[]): void {
    this.#instances = new Map(
      buildings.map((building) => [building.ID, new this(building)]),
    )
  }
}
