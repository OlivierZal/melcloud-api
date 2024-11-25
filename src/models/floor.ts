import { BaseModel } from './base.js'

import type { FloorData } from '../types/common.js'

import type { AreaModel } from './area.js'
import type { BuildingModel } from './building.js'
import type { DeviceModel } from './device.js'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
} from './interfaces.js'

export class FloorModel extends BaseModel implements IFloorModel {
  static #areaModel: typeof AreaModel

  static #buildingModel: typeof BuildingModel

  static #deviceModel: typeof DeviceModel

  static #instances = new Map<number, FloorModel>()

  public readonly buildingId: number

  private constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: FloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): IAreaModel[] {
    return FloorModel.#areaModel.getByFloorId(this.id)
  }

  public get building(): IBuildingModel | undefined {
    return FloorModel.#buildingModel.getById(this.buildingId)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): IDeviceModelAny[] {
    return FloorModel.#deviceModel.getByFloorId(this.id)
  }

  public static getAll(): IFloorModel[] {
    return [...this.#instances.values()]
  }

  public static getByBuildingId(id: number): IFloorModel[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getById(id: number): IFloorModel | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): IFloorModel | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static setModels({
    areaModel,
    buildingModel,
    deviceModel,
  }: {
    areaModel: typeof AreaModel
    buildingModel: typeof BuildingModel
    deviceModel: typeof DeviceModel
  }): void {
    this.#areaModel = areaModel
    this.#buildingModel = buildingModel
    this.#deviceModel = deviceModel
  }

  public static sync(floors: FloorData[]): void {
    this.#instances = new Map(
      floors.map((floor) => [floor.ID, new this(floor)]),
    )
  }
}
