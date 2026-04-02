import type { HomeDevice } from '../types/index.ts'
import { HomeDeviceModel } from './home-device-model.ts'

/**
 * Lightweight device registry for the Home API.
 * Maintains stable model references across syncs using upsert + prune.
 */
export class HomeDeviceRegistry {
  readonly #devices = new Map<string, HomeDeviceModel>()

  public getAll(): HomeDeviceModel[] {
    return [...this.#devices.values()]
  }

  public getById(id: string): HomeDeviceModel | undefined {
    return this.#devices.get(id)
  }

  public sync(devices: HomeDevice[]): void {
    const activeIds = new Set<string>()
    for (const device of devices) {
      activeIds.add(device.id)
      const existing = this.#devices.get(device.id)
      if (existing) {
        existing.sync(device)
      } else {
        this.#devices.set(device.id, new HomeDeviceModel(device))
      }
    }
    for (const id of this.#devices.keys()) {
      if (!activeIds.has(id)) {
        this.#devices.delete(id)
      }
    }
  }
}
