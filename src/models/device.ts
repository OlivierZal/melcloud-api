import type { DeviceType } from '../enums.ts'
import type { ListDevice, ListDeviceData } from '../types/index.ts'

import type { IDeviceModel } from './interfaces.ts'

import { BaseModel } from './base.ts'

export class DeviceModel<T extends DeviceType>
  extends BaseModel
  implements IDeviceModel<T>
{
  public readonly areaId: number | null = null

  public readonly buildingId: number

  public readonly floorId: number | null = null

  public readonly type: T

  #data: ListDeviceData<T>

  public constructor({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    FloorID: floorId,
    Type: type,
  }: ListDevice<T>) {
    super({ id, name })
    this.type = type
    this.areaId = areaId
    this.buildingId = buildingId
    this.floorId = floorId
    this.#data = data
  }

  public get data(): ListDeviceData<T> {
    return this.#data
  }

  public update(data: Partial<ListDeviceData<T>>): void {
    this.#data = { ...this.#data, ...data }
  }
}
