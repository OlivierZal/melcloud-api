import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDeviceType } from '../constants.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { HomeBuildingDevices } from '../entities/home-registry.ts'
import type { HolidayModeUpdate } from '../holiday-mode.ts'
import type { ProtectionUpdate } from '../protection.ts'
import type {
  HomeAtaDeviceData,
  HomeAtwDeviceData,
  HomeFlatZone,
} from '../types/index.ts'
import type { HomeDeviceFacadeAny } from './home-types.ts'
import { HomeBuildingFacade } from './home-building.ts'
import { HomeDeviceAtaFacade } from './home-device-ata.ts'
import { HomeDeviceAtwFacade } from './home-device-atw.ts'
import {
  pushHomeFrostProtection,
  pushHomeHolidayMode,
  pushHomeOverheatProtection,
  toHomeProtectionUnits,
} from './home-protection.ts'

/**
 * Lazily creates and caches Home device facade instances using a WeakMap
 * keyed by model reference. Mirrors the classic ClassicFacadeManager pattern.
 * @category Facades
 */
export class HomeFacadeManager {
  readonly #api: HomeAPIAdapter

  readonly #buildings = new Map<string, HomeBuildingFacade>()

  readonly #facades = new WeakMap<HomeDevice, HomeDeviceFacadeAny>()

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
  ): HomeDeviceFacadeAny | null
  public get(
    instance?: HomeDevice<HomeAtaDeviceData> | HomeDevice<HomeAtwDeviceData>,
  ): HomeDeviceFacadeAny | null {
    if (instance === undefined) {
      return null
    }
    const cached = this.#facades.get(instance)
    if (cached !== undefined) {
      return cached
    }
    const facade = instance.isAta()
      ? new HomeDeviceAtaFacade(this.#api, instance)
      : new HomeDeviceAtwFacade(this.#api, instance)
    this.#facades.set(instance, facade)
    return facade
  }

  /**
   * Returns the cached building facade for the given `/context`
   * building, lazily creating one on first access. Any registered
   * device of the building resolves it, whatever its connection type;
   * `null` only for an unknown id or a building emptied by a sync —
   * stale cache entries are dropped.
   * @param id - Identifier of the `/context` building.
   * @returns The building facade, or `null` when no registered device
   * belongs to the building.
   */
  public getBuilding(id: string): HomeBuildingFacade | null {
    const model = this.#api.registry
      .getDevices()
      .find((device) => device.building.id === id)
    if (model === undefined) {
      this.#buildings.delete(id)
      return null
    }
    const cached = this.#buildings.get(id)
    if (cached !== undefined) {
      return cached
    }
    const facade = new HomeBuildingFacade(this.#api, model.building, (member) =>
      this.get(member),
    )
    this.#buildings.set(id, facade)
    return facade
  }

  /**
   * Groups registry devices by building — the Home counterpart of the
   * Classic manager's `getBuildings`.
   * @param params - Optional filter.
   * @param params.type - Connection-type discriminator; omitted merges
   * both connection types per building.
   * @returns One name-sorted entry per building.
   */
  public getBuildings(params?: {
    type?: HomeDeviceType | undefined
  }): HomeBuildingDevices[] {
    return this.#api.registry.getBuildings(params)
  }

  /**
   * Resolves a device facade by id — the by-id twin of {@link get}.
   * @param id - Device identifier.
   * @returns The facade, or `null` when the id is unknown.
   */
  public getById(id: string): HomeDeviceFacadeAny | null {
    const model = this.#api.registry.getById(id)
    if (model === undefined) {
      return null
    }
    if (model.isAta()) {
      return this.get(model)
    }
    return model.isAtw() ? this.get(model) : null
  }

  /**
   * Flattens the registry into the picker zone list (grouped:
   * name-sorted buildings each followed by their own name-sorted
   * devices; Classic's `getZones` sorts its flat list globally).
   * @param params - Optional filter.
   * @param params.type - Connection-type discriminator; omitted covers
   * both connection types.
   * @returns The flattened zone nodes.
   */
  public getZones(params?: {
    type?: HomeDeviceType | undefined
  }): HomeFlatZone[] {
    return this.#api.registry.getZones(params)
  }

  /**
   * Batch frost-protection update for the given Home devices: groups them
   * by type, clamps the bounds into range, and issues one API write. All
   * ids must belong to this manager's account.
   * @param deviceIds - Target device ids.
   * @param update - The new frost-protection settings.
   */
  public async updateFrostProtection(
    deviceIds: readonly string[],
    update: ProtectionUpdate,
  ): Promise<void> {
    await pushHomeFrostProtection(
      this.#api,
      toHomeProtectionUnits(this.#api, deviceIds),
      update,
    )
  }

  /**
   * Batch holiday-mode update for the given Home devices: groups them by
   * type and issues one API write. Mirror of {@link updateFrostProtection}
   * for the holiday window. All ids must belong to this manager's account.
   * @param deviceIds - Target device ids.
   * @param update - The new holiday-mode window.
   */
  public async updateHolidayMode(
    deviceIds: readonly string[],
    update: HolidayModeUpdate,
  ): Promise<void> {
    await pushHomeHolidayMode(
      this.#api,
      toHomeProtectionUnits(this.#api, deviceIds),
      update,
    )
  }

  /**
   * Batch overheat-protection update for the given Home devices: keeps
   * only the ATA ids (the feature is ATA-only — the official app never
   * sends ATW ids), clamps the bounds into range, and issues one API
   * write when at least one ATA id remains. All ids must belong to this
   * manager's account.
   * @param deviceIds - Target device ids (non-ATA ids are dropped).
   * @param update - The new overheat-protection settings.
   */
  public async updateOverheatProtection(
    deviceIds: readonly string[],
    update: ProtectionUpdate,
  ): Promise<void> {
    await pushHomeOverheatProtection(
      this.#api,
      toHomeProtectionUnits(this.#api, deviceIds),
      update,
    )
  }
}
