import { BaseModel } from './base.js'

import type { DeviceType } from '../enums.js'
import type {
  ListDevice,
  ListDeviceAny,
  ListDeviceData,
} from '../types/index.js'

import type { AreaModel } from './area.js'
import type { BuildingModel } from './building.js'
import type { FloorModel } from './floor.js'
import type {
  IAreaModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
} from './interfaces.js'

export class DeviceModel<T extends DeviceType>
  extends BaseModel
  implements IDeviceModel<T>
{
  static #areaModel: typeof AreaModel

  static #buildingModel: typeof BuildingModel

  static #floorModel: typeof FloorModel

  static #instances = new Map<number, IDeviceModelAny>()

  public readonly areaId: number | null = null

  public readonly buildingId: number

  public readonly floorId: number | null = null

  public readonly type: T

  #data: ListDeviceData<T>

  protected constructor({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    FloorID: floorId,
    Type: type,
  }: ListDevice<T>) {
    super({ id, name })
    this.areaId = areaId
    this.buildingId = buildingId
    this.floorId = floorId
    this.type = type as T
    this.#data = data as ListDeviceData<T>
  }

  public get area(): IAreaModel | null | undefined {
    return this.areaId === null ?
        null
      : DeviceModel.#areaModel.getById(this.areaId)
  }

  public get building(): BuildingModel | undefined {
    return DeviceModel.#buildingModel.getById(this.buildingId)
  }

  public get data(): ListDeviceData<T> {
    return this.#data
  }

  public get floor(): IFloorModel | null | undefined {
    return this.floorId === null ?
        null
      : DeviceModel.#floorModel.getById(this.floorId)
  }

  public static getAll(): IDeviceModelAny[] {
    return [...this.#instances.values()]
  }

  public static getByAreaId(id: number): IDeviceModelAny[] {
    return this.getAll().filter(({ areaId }) => areaId === id)
  }

  public static getByBuildingId(id: number): IDeviceModelAny[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getByFloorId(id: number): IDeviceModelAny[] {
    return this.getAll().filter(({ floorId }) => floorId === id)
  }

  public static getById(id: number): IDeviceModelAny | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): IDeviceModelAny | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static getByType<K extends DeviceType>(type: K): IDeviceModel<K>[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return this.getAll().filter(
      ({ type: instanceType }) => instanceType === type,
    ) as IDeviceModel<K>[]
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        new this(device) as IDeviceModelAny,
      ]),
    )
  }

  public update(data: Partial<ListDeviceData<T>>): void {
    this.#data = { ...this.#data, ...data }
  }
}
