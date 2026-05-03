import type { HomeDeviceType } from '../constants.ts'
import type { HomeDeviceData } from '../types/index.ts'
import { HomeDevice } from './home-device.ts'

/**
 * ClassicDevice with its type, as extracted from building units.
 * @internal
 */
export interface TypedHomeDeviceData {
  readonly device: HomeDeviceData
  readonly type: HomeDeviceType
}

/**
 * Lightweight device registry for the Home API.
 * Maintains stable model references across syncs using upsert + prune.
 */
export class HomeRegistry {
  readonly #devices = new Map<string, HomeDevice>()

  /**
   * Returns every device currently held in the registry.
   * @returns All devices.
   */
  public getAll(): HomeDevice[] {
    return [...this.#devices.values()]
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
    for (const { device, type } of devices) {
      activeIds.add(device.id)
      const existing = this.#devices.get(device.id)
      if (existing) {
        existing.sync(device)
      } else {
        this.#devices.set(device.id, new HomeDevice(device, type))
      }
    }
    for (const id of this.#devices.keys()) {
      if (!activeIds.has(id)) {
        this.#devices.delete(id)
      }
    }
  }
}
