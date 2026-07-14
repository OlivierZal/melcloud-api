import type { HomeDeviceType } from '../constants.ts'
import type { HomeBuildingRef, HomeDeviceData } from '../types/index.ts'
import { HomeDevice } from './home-device.ts'

/**
 * Devices of one `/context` building sharing a connection type — the
 * account-level grouping the registry derives from its devices.
 * @category Entities
 */
export interface HomeBuildingDevices {
  readonly devices: HomeDevice[]
  readonly id: string
  readonly name: string
}

/**
 * Home device with its type, ownership origin and source building, as extracted from building units.
 * @internal
 */
export interface TypedHomeDeviceData {
  readonly building: HomeBuildingRef
  readonly device: HomeDeviceData
  readonly isOwner: boolean
  readonly type: HomeDeviceType
}

/**
 * Lightweight device registry for the Home API.
 * Maintains stable model references across syncs using upsert + prune.
 * @category Entities
 */
export class HomeRegistry {
  readonly #devices = new Map<string, HomeDevice>()

  /**
   * Returns every device currently held in the registry.
   * @returns All devices.
   */
  public getAll(): HomeDevice[] {
    return this.#devices.values().toArray()
  }

  /**
   * Groups the devices of the given connection type by their source
   * building, in registry order (insertion order of the latest sync).
   * @param type - Connection-type discriminator.
   * @returns One entry per building that holds at least one such device.
   */
  public getBuildingsByType(type: HomeDeviceType): HomeBuildingDevices[] {
    const buildings = new Map<string, HomeBuildingDevices>()
    for (const device of this.getByType(type)) {
      const { id, name } = device.building
      const building = buildings.get(id) ?? { devices: [], id, name }
      building.devices.push(device)
      buildings.set(id, building)
    }
    return buildings.values().toArray()
  }

  /**
   * Returns the device with the given id, or `undefined` when no such device is registered.
   * @param id - Device identifier.
   * @returns The device, or `undefined`.
   */
  public getById(id: string): HomeDevice | undefined {
    return this.#devices.get(id)
  }

  /**
   * Returns every device whose connection type matches the given Ata / Atw discriminator.
   * @param type - Connection-type discriminator.
   * @returns The matching devices.
   */
  public getByType(type: HomeDeviceType): HomeDevice[] {
    return this.getAll().filter((model) => model.type === type)
  }

  /**
   * Upserts the device registry from a flat list of typed device payloads;
   * entries absent from `devices` are pruned.
   * @param devices - Fresh typed device payloads.
   */
  public sync(devices: TypedHomeDeviceData[]): void {
    const activeIds = new Set<string>()
    for (const entry of devices) {
      activeIds.add(entry.device.id)
      this.#upsert(entry)
    }
    for (const id of this.#devices.keys()) {
      if (!activeIds.has(id)) {
        this.#devices.delete(id)
      }
    }
  }

  #upsert(entry: TypedHomeDeviceData): void {
    const existing = this.#devices.get(entry.device.id)
    if (existing === undefined) {
      this.#devices.set(entry.device.id, new HomeDevice(entry))
      return
    }
    existing.sync(entry.device, entry.isOwner, entry.building)
  }
}
