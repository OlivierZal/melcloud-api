import type { DeviceType } from '../constants.ts'
import type {
  ListDevice,
  ListDeviceAny,
  ListDeviceData,
  ListDeviceDataAny,
} from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** Concrete device model holding mutable device data that can be partially updated after API calls. */
export class Device<T extends DeviceType> extends BaseModel {
  public areaId: number | null = null

  public buildingId: number

  public floorId: number | null = null

  public readonly modelKind = 'device'

  public readonly type: T

  public get data(): ListDeviceData<T> {
    return this.#data
  }

  readonly #data: ListDeviceData<T>

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

  public [syncModel]({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceName: name,
    FloorID: floorId,
  }: ListDeviceAny): void {
    this.name = name
    this.areaId = areaId
    this.buildingId = buildingId
    this.floorId = floorId
    Object.assign(this.#data, data)
  }

  public update(data: Partial<ListDeviceDataAny>): void {
    Object.assign(this.#data, data)
  }
}
