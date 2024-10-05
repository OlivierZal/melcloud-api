import { DeviceType, type ListDevice, type ListDeviceAny } from '../types'

import { BaseModel } from './base'

import type { AreaModel, AreaModelAny } from './area'
import type { BuildingModel } from './building'
import type { FloorModel } from './floor'
import type { IDeviceModel } from './interfaces'

export type DeviceModelAny =
  | DeviceModel<'Ata'>
  | DeviceModel<'Atw'>
  | DeviceModel<'Erv'>

export class DeviceModel<T extends keyof typeof DeviceType>
  extends BaseModel
  implements IDeviceModel<T>
{
  static readonly #instances = new Map<number, DeviceModelAny>()

  static #areaModel: typeof AreaModel

  static #buildingModel: typeof BuildingModel

  static #floorModel: typeof FloorModel

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
    return this.getAll().find(({ name: modelName }) => modelName === name)
  }

  public static getByType<K extends keyof typeof DeviceType>(
    type: K,
  ): DeviceModel<K>[] {
    return this.getAll().filter(
      ({ type: modelType }) => modelType === type,
    ) as DeviceModel<K>[]
  }

  public static setAreaModel(model: typeof AreaModel): void {
    this.#areaModel = model
  }

  public static setBuildingModel(model: typeof BuildingModel): void {
    this.#buildingModel = model
  }

  public static setFloorModel(model: typeof FloorModel): void {
    this.#floorModel = model
  }

  public static upsert(device: ListDeviceAny): void {
    this.#instances.set(device.DeviceID, new this(device) as DeviceModelAny)
  }

  public static upsertMany(devices: readonly ListDeviceAny[]): void {
    devices.forEach((device) => {
      this.upsert(device)
    })
  }

  public update(data: Partial<ListDevice[T]['Device']>): void {
    this.#data = { ...this.#data, ...data }
  }
}
