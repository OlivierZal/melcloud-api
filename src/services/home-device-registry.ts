import type { HomeDeviceType } from '../constants.ts'
import type { HomeDevice } from '../types/index.ts'
import { HomeDeviceModel } from './home-device-model.ts'

/** Device with its type, as extracted from building units. */
export interface TypedHomeDevice {
  readonly device: HomeDevice
  readonly type: HomeDeviceType
}

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

  public getByType(type: HomeDeviceType): HomeDeviceModel[] {
    return this.getAll().filter((model) => model.type === type)
  }

  public sync(devices: TypedHomeDevice[]): void {
    const activeIds = new Set<string>()
    for (const { device, type } of devices) {
      activeIds.add(device.id)
      const existing = this.#devices.get(device.id)
      if (existing) {
        existing.sync(device)
      } else {
        this.#devices.set(device.id, new HomeDeviceModel(device, type))
      }
    }
    for (const id of this.#devices.keys()) {
      if (!activeIds.has(id)) {
        this.#devices.delete(id)
      }
    }
  }
}
