import type { DeviceType } from '../constants.ts'
import type { ListDevice, ListDeviceData } from '../types/index.ts'

import { BaseModel } from './base.ts'

/** Concrete device model holding mutable device data that can be partially updated after API calls. */
export class DeviceModel<T extends DeviceType> extends BaseModel {
  public readonly type: T

  public areaId: number | null = null

  public buildingId: number

  public floorId: number | null = null

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

  public sync({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceName: name,
    FloorID: floorId,
  }: ListDevice<T>): void {
    this.name = name
    this.areaId = areaId
    this.buildingId = buildingId
    this.floorId = floorId
    this.#data = data
  }

  public update(data: Partial<ListDeviceData<T>>): void {
    this.#data = { ...this.#data, ...data }
  }
}
