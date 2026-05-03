import type { HomeAPIAdapter } from '../api/home-types.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import { HomeDeviceAtaFacade } from './home-device-ata.ts'

/**
 * Lazily creates and caches Home device facade instances using a WeakMap
 * keyed by model reference. Mirrors the classic ClassicFacadeManager pattern.
 * @category Facades
 */
export class HomeFacadeManager {
  readonly #api: HomeAPIAdapter

  readonly #facades = new WeakMap<HomeDevice, HomeDeviceAtaFacade>()

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
   * one on first access; passing `undefined` returns `null`.
   * @param instance - Registry device to wrap, or `undefined`.
   * @returns The facade, or `null` when no instance was supplied.
   */
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
