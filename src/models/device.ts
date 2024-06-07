import {
  AreaModel,
  type AreaModelAny,
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
  public static readonly devices = new Map<
    number,
    DeviceModel<'Ata' | 'Atw' | 'Erv'>
  >()

  #areaId: number | null = null

  #buildingId: number

  #data: ListDevice[T]['Device']

  #floorId: number | null = null

  #id: number

  #name: string

  #type: T

  public constructor({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    FloorID: floorId,
    Type: type,
  }: ListDevice[T]) {
    this.#areaId = areaId
    this.#buildingId = buildingId
    this.#data = data
    this.#floorId = floorId
    this.#id = id
    this.#name = name
    this.#type = DeviceType[type] as T
  }

  public get area(): AreaModelAny | null {
    return this.#areaId === null ?
        null
      : AreaModel.getById(this.#areaId) ?? null
  }

  public get areaId(): number | null {
    return this.#areaId
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.#buildingId) ?? null
  }

  public get buildingId(): number {
    return this.#buildingId
  }

  public get data(): ListDevice[T]['Device'] {
    return this.#data
  }

  public get floor(): FloorModel | null {
    return this.#floorId === null ?
        null
      : FloorModel.getById(this.#floorId) ?? null
  }

  public get floorId(): number | null {
    return this.#floorId
  }

  public get id(): number {
    return this.#id
  }

  public get name(): string {
    return this.#name
  }

  public get type(): T {
    return this.#type
  }

  public static getAll(): DeviceModelAny[] {
    return Array.from(this.devices.values()) as DeviceModelAny[]
  }

  public static getByBuildingId(buildingId: number): DeviceModelAny[] {
    return this.getAll().filter(({ buildingId: id }) => id === buildingId)
  }

  public static getById(id: number): DeviceModelAny | undefined {
    return this.devices.get(id) as DeviceModelAny
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
    if (this.devices.has(data.DeviceID)) {
      this.devices.get(data.DeviceID)?.update(data)
      return
    }
    this.devices.set(data.DeviceID, new this(data) as DeviceModelAny)
  }

  public static upsertMany(dataList: readonly ListDeviceAny[]): void {
    dataList.forEach((data) => {
      this.upsert(data)
    })
  }

  public update({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    FloorID: floorId,
    Type: type,
  }: ListDevice[T]): void {
    this.#areaId = areaId
    this.#buildingId = buildingId
    this.#data = data
    this.#floorId = floorId
    this.#id = id
    this.#name = name
    this.#type = DeviceType[type] as T
  }
}
