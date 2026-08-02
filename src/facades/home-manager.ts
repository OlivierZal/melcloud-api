import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { HomeBuildingDevices } from '../entities/home-registry.ts'
import type { HolidayModeUpdate } from '../holiday-mode.ts'
import type {
  HomeAtaDeviceData,
  HomeAtwDeviceData,
  HomeFlatZone,
  HomeProtectionUnits,
} from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'
import {
  type ProtectionUpdate,
  clampFrostProtection,
  clampOverheatProtection,
} from '../protection.ts'
import type { HomeDeviceFacadeAny } from './home-types.ts'
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
   * Returns the cached ATA group facade for the given `/context` building,
   * lazily creating one on first access. Resolves to `null` while the
   * registry holds no ATA device of that building (unknown id, or a
   * building emptied by a sync) — stale cache entries are dropped.
   * @param id - Identifier of the `/context` building.
   * @returns The building facade, or `null`.
   */
  public getBuilding(id: string): HomeBuildingAtaFacade | null {
    const model = this.#api.registry
      .getDevicesByType(HomeDeviceType.Ata)
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
   * @param root0 - The new frost-protection settings.
   * @param root0.isEnabled - Whether frost protection is on.
   * @param root0.max - Upper bound, in °C (clamped to [6, 16]).
   * @param root0.min - Lower bound, in °C (clamped to [4, 14]).
   */
  public async updateFrostProtection(
    deviceIds: readonly string[],
    { isEnabled, max, min }: ProtectionUpdate,
  ): Promise<void> {
    await this.#api.updateFrostProtection({
      enabled: isEnabled,
      ...clampFrostProtection(min, max),
      units: this.#toUnits(deviceIds),
    })
  }

  /**
   * Batch holiday-mode update for the given Home devices: groups them by
   * type and issues one API write. Mirror of {@link updateFrostProtection}
   * for the holiday window. All ids must belong to this manager's account.
   * @param deviceIds - Target device ids.
   * @param root0 - The new holiday-mode window.
   * @param root0.endDate - Window end, ISO 8601 wall-clock.
   * @param root0.isEnabled - Whether holiday mode is on.
   * @param root0.startDate - Window start, ISO 8601 wall-clock.
   */
  public async updateHolidayMode(
    deviceIds: readonly string[],
    { endDate, isEnabled, startDate }: HolidayModeUpdate,
  ): Promise<void> {
    await this.#api.updateHolidayMode({
      enabled: isEnabled,
      endDate,
      startDate,
      units: this.#toUnits(deviceIds),
    })
  }

  /**
   * Batch overheat-protection update for the given Home devices: keeps
   * only the ATA ids (the feature is ATA-only — the official app never
   * sends ATW ids), clamps the bounds into range, and issues one API
   * write when at least one ATA id remains. All ids must belong to this
   * manager's account.
   * @param deviceIds - Target device ids (non-ATA ids are dropped).
   * @param root0 - The new overheat-protection settings.
   * @param root0.isEnabled - Whether overheat protection is on.
   * @param root0.max - Upper bound, in °C (clamped to [33, 40]).
   * @param root0.min - Lower bound, in °C (clamped to [31, 38]).
   */
  public async updateOverheatProtection(
    deviceIds: readonly string[],
    { isEnabled, max, min }: ProtectionUpdate,
  ): Promise<void> {
    const { ATA: ata } = this.#toUnits(deviceIds)
    if (ata === undefined) {
      return
    }
    await this.#api.updateOverheatProtection({
      enabled: isEnabled,
      ...clampOverheatProtection(min, max),
      units: { ATA: ata },
    })
  }

  // Split device ids into the wire's per-type buckets, skipping ids the
  // registry does not know (a device from another account or a stale id).
  #toUnits(deviceIds: readonly string[]): HomeProtectionUnits {
    const ata: string[] = []
    const atw: string[] = []
    for (const id of deviceIds) {
      const device = this.#api.registry.getById(id)
      if (device?.isAta() === true) {
        ata.push(id)
      } else if (device?.isAtw() === true) {
        atw.push(id)
      }
    }
    return {
      ...(ata.length > 0 && { ATA: ata }),
      ...(atw.length > 0 && { ATW: atw }),
    }
  }
}
