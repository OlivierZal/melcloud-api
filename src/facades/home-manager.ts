import type { HomeAPI } from '../api/home-interfaces.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import { HomeDeviceAtaFacade } from './home-device-ata.ts'

/**
 * Lazily creates and caches Home device facade instances using a WeakMap
 * keyed by model reference. Mirrors the classic ClassicFacadeManager pattern.
 */
export class HomeFacadeManager {
  readonly #api: HomeAPI

  readonly #facades = new WeakMap<HomeDevice, HomeDeviceAtaFacade>()

  public constructor(api: HomeAPI) {
    this.#api = api
  }

  public get(instance: HomeDevice): HomeDeviceAtaFacade
  public get(): null
  public get(instance?: HomeDevice): HomeDeviceAtaFacade | null
  public get(instance?: HomeDevice): HomeDeviceAtaFacade | null {
    if (!instance) {
      return null
    }
    let facade = this.#facades.get(instance)
    if (!facade) {
      facade = new HomeDeviceAtaFacade(this.#api, instance)
      this.#facades.set(instance, facade)
    }
    return facade
  }
}
