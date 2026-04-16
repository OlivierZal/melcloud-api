import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicListDevice,
  ClassicListDeviceAny,
  ClassicListDeviceData,
  ClassicListDeviceDataAny,
} from '../types/index.ts'
import { BaseModel } from './base.ts'
import { syncModel } from './symbols.ts'

/** Concrete device model holding mutable device data that can be partially updated after API calls. */
export class ClassicDevice<T extends ClassicDeviceType> extends BaseModel {
  public areaId: number | null = null

  public buildingId: number

  public floorId: number | null = null

  public readonly modelKind = 'device'

  public readonly type: T

  public get data(): ClassicListDeviceData<T> {
    return this.#data
  }

  readonly #data: ClassicListDeviceData<T>

  public constructor({
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceID: id,
    DeviceName: name,
    FloorID: floorId,
    Type: type,
  }: ClassicListDevice<T>) {
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
  }: ClassicListDeviceAny): void {
    this.name = name
    this.areaId = areaId
    this.buildingId = buildingId
    this.floorId = floorId
    Object.assign(this.#data, data)
  }

  public update(data: Partial<ClassicListDeviceDataAny>): void {
    Object.assign(this.#data, data)
  }
}
