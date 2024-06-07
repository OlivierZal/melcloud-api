import {
  AreaModel,
  BuildingModel,
  type DeviceModel,
  FloorModel,
  type IDeviceModel,
} from '.'
import { DeviceType, type ListDevice, type ListDeviceAny } from '../types'

export type DeviceModelAny =
  | DeviceModel<'Ata'>
  | DeviceModel<'Atw'>
  | DeviceModel<'Erv'>

export default class<T extends keyof typeof DeviceType>
  implements IDeviceModel<T>
{
  public static readonly devices = new Map<number, DeviceModelAny>()

  public readonly areaId: number | null = null

  public readonly buildingId: number

  public readonly data: ListDevice[T]['Device']

  public readonly floorId: number | null = null

  public readonly id: number

  public readonly name: string

  public readonly type: T

  public constructor({
    AreaID: areaId,
    BuildingID: buildingId,
    FloorID: floorId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    Type: type,
  }: ListDevice[T]) {
    this.id = id
    this.name = name
    this.type = DeviceType[type] as T
    this.data = data
    this.buildingId = buildingId
    this.areaId = areaId
    this.floorId = floorId
  }

  public get area(): AreaModel | null {
    if (this.areaId === null) {
      return null
    }
    return AreaModel.getById(this.areaId) ?? null
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.buildingId) ?? null
  }

  public get floor(): FloorModel | null {
    if (this.floorId === null) {
      return null
    }
    return FloorModel.getById(this.floorId) ?? null
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
