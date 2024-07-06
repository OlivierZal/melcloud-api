import AreaModel, { type AreaModelAny } from './area'
import { DeviceType, type ListDevice, type ListDeviceAny } from '../types'
import BaseModel from './base'
import BuildingModel from './building'
import FloorModel from './floor'
import type { IDeviceModel } from './interfaces'

export type DeviceModelAny =
  | DeviceModel<'Ata'>
  | DeviceModel<'Atw'>
  | DeviceModel<'Erv'>

export default class DeviceModel<T extends keyof typeof DeviceType>
  extends BaseModel
  implements IDeviceModel<T>
{
  static readonly #devices = new Map<number, DeviceModelAny>()

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

  public get area(): AreaModelAny | null {
    return this.areaId === null ? null : AreaModel.getById(this.areaId) ?? null
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.buildingId) ?? null
  }

  public get data(): ListDevice[T]['Device'] {
    return this.#data
  }

  public get floor(): FloorModel | null {
    return this.floorId === null ?
        null
      : FloorModel.getById(this.floorId) ?? null
  }

  public static getAll(): DeviceModelAny[] {
    return [...this.#devices.values()]
  }

  public static getByAreaId(id: number): DeviceModelAny[] {
    return this.getAll().filter((model) => model.areaId === id)
  }

  public static getByBuildingId(id: number): DeviceModelAny[] {
    return this.getAll().filter((model) => model.buildingId === id)
  }

  public static getByFloorId(id: number): DeviceModelAny[] {
    return this.getAll().filter((model) => model.floorId === id)
  }

  public static getById(id: number): DeviceModelAny | undefined {
    return this.#devices.get(id)
  }

  public static getByName(name: string): DeviceModelAny | undefined {
    return this.getAll().find((model) => model.name === name)
  }

  public static getByType<K extends keyof typeof DeviceType>(
    type: K,
  ): DeviceModel<K>[] {
    return this.getAll().filter(
      (model) => model.type === type,
    ) as DeviceModel<K>[]
  }

  public static upsert(device: ListDeviceAny): void {
    this.#devices.set(device.DeviceID, new this(device) as DeviceModelAny)
  }

  public static upsertMany(devices: readonly ListDeviceAny[]): void {
    devices.forEach((device) => {
      this.upsert(device)
    })
  }

  public update(data: Partial<ListDevice[T]['Device']>): void {
    this.#data = {
      ...this.#data,
      ...data,
    }
  }
}
