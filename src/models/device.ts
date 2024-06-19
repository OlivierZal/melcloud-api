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
  public static readonly devices = new Map<number, DeviceModelAny>()

  public readonly areaId: number | null = null

  public readonly buildingId: number

  public readonly data: ListDevice[T]['Device']

  public readonly floorId: number | null = null

  public readonly type: T

  private constructor({
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
    this.data = data
    this.floorId = floorId
    this.type = DeviceType[type] as T
  }

  public get area(): AreaModelAny | null {
    return this.areaId === null ? null : AreaModel.getById(this.areaId) ?? null
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.buildingId) ?? null
  }

  public get floor(): FloorModel | null {
    return this.floorId === null ?
        null
      : FloorModel.getById(this.floorId) ?? null
  }

  public static getAll(): DeviceModelAny[] {
    return Array.from(this.devices.values())
  }

  public static getByBuildingId(buildingId: number): DeviceModelAny[] {
    return this.getAll().filter(({ buildingId: id }) => id === buildingId)
  }

  public static getById(id: number): DeviceModelAny | undefined {
    return this.devices.get(id)
  }

  public static getByName(deviceName: string): DeviceModelAny | undefined {
    return this.getAll().find(({ name }) => name === deviceName)
  }

  public static getByType(
    deviceType: keyof typeof DeviceType,
  ): DeviceModelAny[] {
    return this.getAll().filter(({ type }) => type === deviceType)
  }

  public static upsert(data: ListDeviceAny): void {
    this.devices.set(data.DeviceID, new this(data) as DeviceModelAny)
  }

  public static upsertMany(dataList: readonly ListDeviceAny[]): void {
    dataList.forEach((data) => {
      this.upsert(data)
    })
  }
}
