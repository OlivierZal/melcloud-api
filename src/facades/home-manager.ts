import type { HomeDeviceModel } from '../services/home-device-model.ts'
import type { HomeAPI } from '../services/interfaces.ts'
import { HomeDeviceAtaFacade } from './home-device-ata.ts'

/**
 * Lazily creates and caches Home device facade instances using a WeakMap
 * keyed by model reference. Mirrors the classic FacadeManager pattern.
 */
export class HomeFacadeManager {
  readonly #api: HomeAPI

  readonly #facades = new WeakMap<HomeDeviceModel, HomeDeviceAtaFacade>()

  public constructor(api: HomeAPI) {
    this.#api = api
  }

  public get(instance: HomeDeviceModel): HomeDeviceAtaFacade
  public get(): null
  public get(instance?: HomeDeviceModel): HomeDeviceAtaFacade | null
  public get(instance?: HomeDeviceModel): HomeDeviceAtaFacade | null {
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
