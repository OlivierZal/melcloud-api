import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import { HomeDeviceAtaFacade } from './home-device-ata.ts'
import { HomeDeviceAtwFacade } from './home-device-atw.ts'

/**
 * Lazily creates and caches Home device facade instances using a WeakMap
 * keyed by model reference. Mirrors the classic ClassicFacadeManager pattern.
 * @category Facades
 */
export class HomeFacadeManager {
  readonly #api: HomeAPIAdapter

  readonly #facades = new WeakMap<
    HomeDevice,
    HomeDeviceAtaFacade | HomeDeviceAtwFacade
  >()

  /**
   * Builds a facade manager bound to the given Home API client; facades
   * it returns share this reference.
   * @param api - Home API client.
   */
  public constructor(api: HomeAPIAdapter) {
    this.#api = api
  }

  /**
   * Returns the cached facade for the given Home device, lazily creating
   * one on first access. Dispatches on the device's type discriminator
   * to construct the matching ATA or ATW facade.
   * @param instance - Registry device to wrap, or `undefined`.
   * @returns The facade, or `null` when no instance was supplied.
   */
  public get(instance?: HomeDevice): HomeDeviceAtaFacade | HomeDeviceAtwFacade | null {
    if (instance === undefined) {
      return null
    }
    const cached = this.#facades.get(instance)
    if (cached !== undefined) {
      return cached
    }
    const facade = this.#build(instance)
    if (facade === null) {
      return null
    }
    this.#facades.set(instance, facade)
    return facade
  }

  #build(
    instance: HomeDevice,
  ): HomeDeviceAtaFacade | HomeDeviceAtwFacade | null {
    if (instance.isAta()) {
      return new HomeDeviceAtaFacade(this.#api, instance)
    }
    if (instance.isAtw()) {
      return new HomeDeviceAtwFacade(this.#api, instance)
    }
    return null
  }
}
