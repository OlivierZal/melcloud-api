import {
  DeviceType,
  type ListDevice,
  type ListDeviceAny,
} from '../types/index.js'

import { BaseModel } from './base.js'

import type { AreaModel } from './area.js'
import type { BuildingModel } from './building.js'
import type { FloorModel } from './floor.js'
import type {
  AreaModelAny,
  DeviceModelAny,
  IDeviceModel,
} from './interfaces.js'

export class DeviceModel<T extends keyof typeof DeviceType>
  extends BaseModel
  implements IDeviceModel<T>
{
  static #areaModel: typeof AreaModel

  static #buildingModel: typeof BuildingModel

  static #floorModel: typeof FloorModel

  static #instances = new Map<number, DeviceModelAny>()

  public readonly areaId: number | null = null

  public readonly buildingId: number

  public readonly floorId: number | null = null

  public readonly type: T

  #data: ListDevice[T]['Device']

  protected constructor({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    FloorID: floorId,
    Type: type,
  }: ListDevice[T]) {
    super({ id, name })
    this.areaId = areaId
    this.buildingId = buildingId
    this.floorId = floorId
    this.type = DeviceType[type] as T
    this.#data = data
  }

  public get area(): AreaModelAny | null | undefined {
    return this.areaId === null ?
        null
      : DeviceModel.#areaModel.getById(this.areaId)
  }

  public get building(): BuildingModel | undefined {
    return DeviceModel.#buildingModel.getById(this.buildingId)
  }

  public get data(): ListDevice[T]['Device'] {
    return this.#data
  }

  public get floor(): FloorModel | null | undefined {
    return this.floorId === null ?
        null
      : DeviceModel.#floorModel.getById(this.floorId)
  }

  public static getAll(): DeviceModelAny[] {
    return [...this.#instances.values()]
  }

  public static getByAreaId(id: number): DeviceModelAny[] {
    return this.getAll().filter(({ areaId }) => areaId === id)
  }

  public static getByBuildingId(id: number): DeviceModelAny[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getByFloorId(id: number): DeviceModelAny[] {
    return this.getAll().filter(({ floorId }) => floorId === id)
  }

  public static getById(id: number): DeviceModelAny | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): DeviceModelAny | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static getByType<K extends keyof typeof DeviceType>(
    type: K,
  ): DeviceModel<K>[] {
    return this.getAll().filter(
      ({ type: instanceType }) => instanceType === type,
    ) as DeviceModel<K>[]
  }

  public static setModels({
    areaModel,
    buildingModel,
    floorModel,
  }: {
    areaModel: typeof AreaModel
    buildingModel: typeof BuildingModel
    floorModel: typeof FloorModel
  }): void {
    this.#areaModel = areaModel
    this.#buildingModel = buildingModel
    this.#floorModel = floorModel
  }

  public static sync(devices: readonly ListDeviceAny[]): void {
    this.#instances = new Map(
      devices.map((device) => [
        device.DeviceID,
        new this(device) as DeviceModelAny,
      ]),
    )
  }

  public update(data: Partial<ListDevice[T]['Device']>): void {
    this.#data = { ...this.#data, ...data }
  }
}
