import AreaModel, { type AreaModelAny } from './area'
import {
  DeviceType,
  type KeysOfSetDeviceDataAtaNotInList,
  type ListDevice,
  type ListDeviceAny,
  type NonFlagsKeyOf,
  type UpdatedDeviceData,
  flags,
  fromSetToListMappingAta,
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

  public readonly floorId: number | null = null

  public readonly type: T

  #data: ListDevice[T]['Device']

  readonly #flags: Record<NonFlagsKeyOf<UpdatedDeviceData<T>>, number>

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
    this.#flags = flags[this.type] as Record<
      NonFlagsKeyOf<UpdatedDeviceData<T>>,
      number
    >
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
        KeysOfSetDeviceDataAtaNotInList
      >),
    }
  }

  #cleanData(
    data: UpdatedDeviceData<T>,
  ): Omit<UpdatedDeviceData<T>, KeysOfSetDeviceDataAtaNotInList> {
    return this.type === 'Ata' ?
        (Object.fromEntries(
          Object.entries(data)
            .filter(([key]) => key in this.#flags)
            .map(([key, value]) =>
              key in fromSetToListMappingAta ?
                [
                  fromSetToListMappingAta[
                    key as KeysOfSetDeviceDataAtaNotInList
                  ],
                  value,
                ]
              : [key, value],
            ),
        ) as Omit<UpdatedDeviceData<T>, KeysOfSetDeviceDataAtaNotInList>)
      : data
  }
}
