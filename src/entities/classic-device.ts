import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicListDevice,
  ClassicListDeviceAny,
  ClassicListDeviceData,
  ClassicListDeviceDataAny,
} from '../types/index.ts'
import { BaseModel } from './base.ts'

/** Concrete device model holding mutable device data that can be partially updated after API calls. */
export class ClassicDevice<T extends ClassicDeviceType> extends BaseModel {
  public areaId: number | null = null

  public buildingId: number

  public floorId: number | null = null

  public readonly modelKind = 'device'

  public readonly type: T

  public get data(): Readonly<ClassicListDeviceData<T>> {
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

  public update(data: Partial<ClassicListDeviceDataAny>): void {
    Object.assign(this.#data, data)
  }
}

/**
 * Apply a sync update from upstream device data onto an existing model.
 *
 * Module-internal: not re-exported from `entities/index.ts`. Identifying
 * fields and the mutable device payload are reset; the per-device-type
 * generic is checked at the call site (`model.type === source.Type`).
 * @param model - The model to mutate in-place.
 * @param source - The fresh list-device entry from the upstream API.
 * @param source.AreaID - Owning area identifier (or `null` if directly under the building).
 * @param source.BuildingID - Owning building identifier.
 * @param source.Device - Mutable device payload merged onto the existing data.
 * @param source.DeviceName - Updated device display name.
 * @param source.FloorID - Owning floor identifier (or `null`).
 */
export const syncDevice = (
  model: ClassicDevice<ClassicDeviceType>,
  {
    AreaID: areaId,
    BuildingID: buildingId,
    Device: data,
    DeviceName: name,
    FloorID: floorId,
  }: ClassicListDeviceAny,
): void => {
  model.name = name
  model.areaId = areaId
  model.buildingId = buildingId
  model.floorId = floorId
  model.update(data)
}
