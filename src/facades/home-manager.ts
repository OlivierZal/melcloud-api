import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { HomeAtaDeviceData, HomeAtwDeviceData } from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'
import { HomeBuildingAtaFacade } from './home-building-ata.ts'
import { HomeDeviceAtaFacade } from './home-device-ata.ts'
import { HomeDeviceAtwFacade } from './home-device-atw.ts'

/**
 * Lazily creates and caches Home device facade instances using a WeakMap
 * keyed by model reference. Mirrors the classic ClassicFacadeManager pattern.
 * @category Facades
 */
export class HomeFacadeManager {
  readonly #api: HomeAPIAdapter

  readonly #buildings = new Map<string, HomeBuildingAtaFacade>()

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
   * one on first access. The overloads preserve type-narrowing: callers
   * who already discriminated `instance` via `isAta()`/`isAtw()` get the
   * matching facade type back without runtime checks.
   * @param instance - Registry device to wrap, or `undefined`.
   * @returns The facade, or `null` when no instance was supplied.
   */
  public get(instance: HomeDevice<HomeAtaDeviceData>): HomeDeviceAtaFacade
  public get(instance: HomeDevice<HomeAtwDeviceData>): HomeDeviceAtwFacade
  public get(): null
  public get(
    instance?: HomeDevice<HomeAtaDeviceData> | HomeDevice<HomeAtwDeviceData>,
  ): HomeDeviceAtaFacade | HomeDeviceAtwFacade | null
  public get(
    instance?: HomeDevice<HomeAtaDeviceData> | HomeDevice<HomeAtwDeviceData>,
  ): HomeDeviceAtaFacade | HomeDeviceAtwFacade | null {
    if (instance === undefined) {
      return null
    }
    const cached = this.#facades.get(instance)
    if (cached !== undefined) {
      return cached
    }
    const facade =
      instance.isAta() ?
        new HomeDeviceAtaFacade(this.#api, instance)
      : new HomeDeviceAtwFacade(this.#api, instance)
    this.#facades.set(instance, facade)
    return facade
  }

  /**
   * Returns the cached ATA group facade for the given `/context` building,
   * lazily creating one on first access. Resolves to `null` while the
   * registry holds no ATA device of that building (unknown id, or a
   * building emptied by a sync) — stale cache entries are dropped.
   * @param id - Identifier of the `/context` building.
   * @returns The building facade, or `null`.
   */
  public getBuilding(id: string): HomeBuildingAtaFacade | null {
    const model = this.#api.registry
      .getByType(HomeDeviceType.Ata)
      .find((device) => device.building.id === id)
    if (model === undefined) {
      this.#buildings.delete(id)
      return null
    }
    const cached = this.#buildings.get(id)
    if (cached !== undefined) {
      return cached
    }
    const facade = new HomeBuildingAtaFacade(
      this.#api,
      model.building,
      (member) => this.get(member),
    )
    this.#buildings.set(id, facade)
    return facade
  }
}
