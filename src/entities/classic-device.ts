import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicAreaID,
  ClassicBuildingID,
  ClassicDeviceID,
  ClassicFloorID,
  ClassicListDevice,
  ClassicListDeviceAny,
  ClassicListDeviceData,
  ClassicListDeviceDataAny,
} from '../types/index.ts'
import { BaseModel } from './base.ts'
import { readCommunicationSilence } from './types.ts'

/**
 * One edge of a Classic unit's communication with MELCloud, as a sync
 * reports it. `stale` is the first sync that reads the unit's
 * `LastTimeStamp` older than {@link STALE_COMMUNICATION_HOURS} — a unit
 * that JOINS the registry that way included, so a host that starts
 * over a silent unit says so — and `resumed` the first that reads it
 * fresh again. Both carry the stamp the listing gave, building-local
 * wall clock. A steady state either way is `null`, not a member, and
 * so is a stamp that cannot be read: it moves nothing.
 * @category Entities
 */
export interface ClassicCommunicationTransition {
  readonly kind: 'resumed' | 'stale'
  readonly lastTimestamp: string
}

/**
 * Concrete device model holding mutable device data that can be partially
 * updated after API calls.
 * @template T - Device type discriminator narrowing the `data` payload to its
 * device-type-specific shape.
 * @category Entities
 */
export class ClassicDevice<
  T extends ClassicDeviceType,
> extends BaseModel<ClassicDeviceID> {
  public areaId: ClassicAreaID | null = null

  public buildingId: ClassicBuildingID

  public floorId: ClassicFloorID | null = null

  public readonly modelKind = 'device'

  public readonly type: T

  /**
   * Last-synced wire-format payload for this device.
   * @returns A read-only snapshot of the device data.
   */
  public get data(): Readonly<ClassicListDeviceData<T>> {
    return this.#data
  }

  readonly #data: ClassicListDeviceData<T>

  #isStale = false

  /**
   * Builds a device model from a wire-format {@link ClassicListDevice} entry;
   * the typed `Device` payload is captured by reference for in-place sync.
   * @param source - Wire-format list-device entry.
   * @param source.AreaID - Owning area identifier (or `null`).
   * @param source.BuildingID - Owning building identifier.
   * @param source.Device - Device payload kept by reference.
   * @param source.DeviceID - Device identifier.
   * @param source.DeviceName - Device display name.
   * @param source.FloorID - Owning floor identifier (or `null`).
   * @param source.Type - Device type discriminator.
   */
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

  /**
   * Reads the listing's stamp against the staleness predicate the
   * facade's `isAvailable` reads, and remembers the verdict.
   * Registry-internal: the registry calls it once per listing sync,
   * after the payload is merged — a write's echo never moves it.
   * @returns The communication edge this sync crossed, `null` for a
   * steady state.
   */
  public trackCommunication(): ClassicCommunicationTransition | null {
    const { LastTimeStamp: lastTimestamp } = this.#data
    const isStale = readCommunicationSilence(lastTimestamp)
    // A stamp that cannot be read is no news: the verdict of the last
    // one that could be read stands, and no edge is answered.
    if (isStale === null || isStale === this.#isStale) {
      return null
    }
    this.#isStale = isStale
    return { kind: isStale ? 'stale' : 'resumed', lastTimestamp }
  }

  /**
   * Merges a partial device payload onto the existing data so consumers
   * keep stable object identity across syncs.
   * @param data - Partial wire-format payload to merge.
   */
  public update(data: Partial<ClassicListDeviceDataAny>): void {
    Object.assign(this.#data, data)
  }
}

/**
 * Apply a sync update from upstream device data onto an existing model.
 *
 * Module-internal: not re-exported from `entities/index.ts`. Identifying
 * fields are reassigned and the mutable device payload is merged in
 * (via `model.update`, which `Object.assign`s into the existing data
 * so consumers keep stable object identity). The per-device-type
 * generic is checked at the call site (`model.type === source.Type`).
 * @param model - The model to mutate in-place.
 * @param source - The fresh list-device entry from the upstream API.
 * @param source.AreaID - Owning area identifier (or `null` if directly under
 * the building).
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
