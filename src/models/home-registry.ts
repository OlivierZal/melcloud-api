import type { HomeDeviceType } from '../constants.ts'
import type { HomeDeviceData } from '../types/index.ts'
import { HomeDevice } from './home-device.ts'

/** Device with its type, as extracted from building units. */
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

  public getAll(): HomeDevice[] {
    return [...this.#devices.values()]
  }

  public getById(id: string): HomeDevice | undefined {
    return this.#devices.get(id)
  }

  public getByType(type: HomeDeviceType): HomeDevice[] {
    return this.getAll().filter((model) => model.type === type)
  }

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
