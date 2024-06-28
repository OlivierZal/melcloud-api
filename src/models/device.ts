import AreaModel, { type AreaModelAny } from './area'
import {
  DeviceType,
  type ListDevice,
  type ListDeviceAny,
  type NonFlagsKeyOf,
  type UpdateDeviceData,
  type UpdatedDeviceData,
  flags,
} from '../types'
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

  public readonly flags: Record<NonFlagsKeyOf<UpdateDeviceData[T]>, number>

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
    this.#data = data
    this.floorId = floorId
    this.type = DeviceType[type] as T
    this.flags = flags[this.type]
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
    return Array.from(this.#devices.values())
  }

  public static getByAreaId(id: number): DeviceModelAny[] {
    return this.getAll().filter((model) => id === model.areaId)
  }

  public static getByBuildingId(id: number): DeviceModelAny[] {
    return this.getAll().filter((model) => id === model.buildingId)
  }

  public static getByFloorId(id: number): DeviceModelAny[] {
    return this.getAll().filter((model) => id === model.floorId)
  }

  public static getById(id: number): DeviceModelAny | undefined {
    return this.#devices.get(id)
  }

  public static getByName(name: string): DeviceModelAny | undefined {
    return this.getAll().find((model) => name === model.name)
  }

  public static getByType(type: keyof typeof DeviceType): DeviceModelAny[] {
    return this.getAll().filter((model) => type === model.type)
  }

  public static upsert(data: ListDeviceAny): void {
    this.#devices.set(data.DeviceID, new this(data) as DeviceModelAny)
  }

  public static upsertMany(dataList: readonly ListDeviceAny[]): void {
    dataList.forEach((data) => {
      this.upsert(data)
    })
  }

  public update(data: UpdatedDeviceData<T>): void {
    this.#data = {
      ...this.#data,
      ...(this.#cleanData(data) satisfies Omit<
        UpdatedDeviceData<T>,
        'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
      >),
    }
  }

  #cleanData(
    data: UpdatedDeviceData<T>,
  ): Omit<
    UpdatedDeviceData<T>,
    'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
  > {
    return {
      ...Object.fromEntries(
        Object.entries(data)
          .filter(([key]) => key in this.flags)
          .map(([key, value]) => {
            switch (key) {
              case 'SetFanSpeed':
                return ['FanSpeed', value]
              case 'VaneHorizontal':
                return ['VaneHorizontalDirection', value]
              case 'VaneVertical':
                return ['VaneVerticalDirection', value]
              default:
                return [key, value]
            }
          }),
      ),
    } as Omit<
      UpdatedDeviceData<T>,
      'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
    >
  }
}
