import { DateTime } from 'luxon'

import type {
  ClassicAPIAdapter,
  ClassicErrorLog,
  ClassicErrorLogQuery,
} from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicDevice,
  ClassicDeviceAny,
  ClassicModel,
  ClassicRegistry,
} from '../entities/index.ts'
import { classicUpdateDevices, syncDevices } from '../decorators/index.ts'
import { EntityNotFoundError } from '../errors/index.ts'
import {
  type ClassicDateTimeComponents,
  type ClassicFailureData,
  type ClassicFrostProtectionData,
  type ClassicFrostProtectionLocation,
  type ClassicHolidayModeData,
  type ClassicHolidayModeLocation,
  type ClassicHolidayModeTimeZone,
  type ClassicSettingsParams,
  type ClassicSuccessData,
  type ClassicTilesData,
  toClassicDeviceId,
} from '../types/index.ts'
import { getChartLineOptions, now } from '../utils.ts'
import type {
  ClassicFacade,
  ClassicFrostProtectionQuery,
  ClassicHolidayModeQuery,
} from './classic-interfaces.ts'
import type { ReportChartLineOptions } from './interfaces.ts'

/*
 * Settings can be defined at zone or device level. Try zone first;
 * if unsupported, fall back to device level and cache the result.
 */
const getWithZoneFallback = async <TResult>(
  isAtZoneLevel: boolean | null,
  zoneGetter: () => Promise<TResult>,
  deviceGetter: () => Promise<TResult>,
): Promise<TResult> => {
  if (isAtZoneLevel === null) {
    try {
      return await zoneGetter()
    } catch {
      return deviceGetter()
    }
  }
  return isAtZoneLevel ? zoneGetter() : deviceGetter()
}

// Minimum 2°C gap between min and max to prevent invalid frost protection ranges
const TEMPERATURE_GAP = 2

const temperatureRange = { max: 16, min: 4 }

const getDateTimeComponents = (
  date: DateTime | null,
): ClassicDateTimeComponents =>
  date ?
    {
      Day: date.day,
      Hour: date.hour,
      Minute: date.minute,
      Month: date.month,
      Second: date.second,
      Year: date.year,
    }
  : null

/**
 * Abstract base for all facades. Provides common functionality for frost protection,
 * holiday mode, power control, signal strength, tiles, and error log retrieval.
 * Settings resolution falls back from zone level to device level when needed.
 */
export abstract class BaseFacade<
  T extends ClassicModel,
> implements ClassicFacade {
  protected abstract readonly frostProtectionLocation: keyof ClassicFrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof ClassicHolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: ClassicSettingsParams['tableName']

  public abstract get devices(): ClassicDeviceAny[]

  public readonly id: number

  /**
   * Whether the underlying entity still exists in the registry.
   * Non-throwing introspection: returns `false` instead of throwing
   * {@link EntityNotFoundError} when the registry no longer holds the id.
   * Useful for consumers that maintain a cached facade reference and
   * want to detect staleness without a `try/catch`.
   * @returns `true` when the entity is still resolvable, `false` otherwise.
   */
  public get exists(): boolean {
    return this.model.getById(this.id) !== undefined
  }

  public get name(): string {
    return this.instance.name
  }

  protected readonly api: ClassicAPIAdapter

  protected isFrostProtectionAtZoneLevel: boolean | null = null

  protected isHolidayModeAtZoneLevel: boolean | null = null

  protected readonly registry: ClassicRegistry

  protected get instance(): T {
    const instance = this.model.getById(this.id)
    if (!instance) {
      throw new EntityNotFoundError(this.tableName, this.id)
    }
    return instance
  }

  // Zone-level settings are shared across devices, so any device id samples the zone's state.
  get #anyDeviceId(): number {
    const [id] = this.#deviceIds
    if (id === undefined) {
      throw new Error(
        `No device found for ${this.tableName} with id ${String(this.id)}`,
      )
    }
    return id
  }

  get #deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  get #deviceNames(): string[] {
    return this.devices.map(({ name }) => name)
  }

  public constructor(
    api: ClassicAPIAdapter,
    registry: ClassicRegistry,
    instance: ClassicModel,
  ) {
    this.api = api
    this.registry = registry
    ;({ id: this.id } = instance)
  }

  @syncDevices()
  @classicUpdateDevices()
  public async updatePower(isOn = true): Promise<boolean> {
    const { data: isPowered } = await this.api.updatePower({
      postData: {
        DeviceIds: this.#deviceIds.map((id) => toClassicDeviceId(id)),
        Power: isOn,
      },
    })
    return isPowered
  }

  public async getErrorLog(
    query: ClassicErrorLogQuery,
  ): Promise<ClassicErrorLog> {
    return this.api.getErrorLog(query, this.#deviceIds)
  }

  public async getFrostProtection(): Promise<ClassicFrostProtectionData> {
    return getWithZoneFallback(
      this.isFrostProtectionAtZoneLevel,
      async () => this.#getZoneFrostProtection(),
      async () => this.#getDevicesFrostProtection(),
    )
  }

  public async getHolidayMode(): Promise<ClassicHolidayModeData> {
    return getWithZoneFallback(
      this.isHolidayModeAtZoneLevel,
      async () => this.#getZoneHolidayMode(),
      async () => this.#getDevicesHolidayMode(),
    )
  }

  public async getSignalStrength(
    hour = DateTime.now().hour,
  ): Promise<ReportChartLineOptions> {
    const { data } = await this.api.getSignal({
      postData: { devices: this.#deviceIds, hour },
    })
    return getChartLineOptions(data, this.#deviceNames, 'dBm')
  }

  public async getTiles(device?: false): Promise<ClassicTilesData<null>>
  public async getTiles<TDeviceType extends ClassicDeviceType>(
    device: ClassicDevice<TDeviceType>,
  ): Promise<ClassicTilesData<TDeviceType>>
  public async getTiles<TDeviceType extends ClassicDeviceType>(
    device: false | ClassicDevice<TDeviceType> = false,
  ): Promise<ClassicTilesData<TDeviceType | null>> {
    const postData = {
      DeviceIDs: this.#deviceIds.map((id) => toClassicDeviceId(id)),
    }
    if (device === false || !this.#deviceIds.includes(device.id)) {
      const { data } = await this.api.getTiles({ postData })
      return data
    }
    const { data } = await this.api.getTiles({
      postData: {
        ...postData,
        SelectedBuilding: device.buildingId,
        SelectedDevice: device.id,
      },
    })
    return data as ClassicTilesData<TDeviceType>
  }

  public async notifySync({
    type,
  }: { type?: ClassicDeviceType } = {}): Promise<void> {
    await this.api.onSync?.({ ids: this.#deviceIds, type })
  }

  public async updateFrostProtection({
    isEnabled = true,
    max,
    min,
  }: ClassicFrostProtectionQuery): Promise<
    ClassicFailureData | ClassicSuccessData
  > {
    /*
     * Clamp to [4°C, 16°C], ensure minimum gap, then re-enforce gap
     * in case the adjustment pushed max out of bounds
     */
    const newMin = Math.max(
      temperatureRange.min,
      Math.min(min, temperatureRange.max - TEMPERATURE_GAP),
    )
    let newMax = Math.min(
      temperatureRange.max,
      Math.max(max, temperatureRange.min + TEMPERATURE_GAP),
    )
    if (newMax - newMin < TEMPERATURE_GAP) {
      newMax = newMin + TEMPERATURE_GAP
    }
    const { data } = await this.api.updateFrostProtection({
      postData: {
        Enabled: isEnabled,
        MaximumTemperature: newMax,
        MinimumTemperature: newMin,
        ...(await this.#getFrostProtectionLocation()),
      },
    })
    return data
  }

  public async updateHolidayMode({
    from,
    to,
  }: ClassicHolidayModeQuery = {}): Promise<
    ClassicFailureData | ClassicSuccessData
  > {
    const isEnabled = to !== undefined
    const startDate = isEnabled ? DateTime.fromISO(from ?? now()) : null
    const endDate = isEnabled ? DateTime.fromISO(to) : null
    const { data } = await this.api.updateHolidayMode({
      postData: {
        Enabled: isEnabled,
        EndDate: getDateTimeComponents(endDate),
        HMTimeZones: await this.#getHolidayModeLocation(),
        StartDate: getDateTimeComponents(startDate),
      },
    })
    return data
  }

  async #getBaseFrostProtection(
    params: ClassicSettingsParams,
    isDefined = true,
  ): Promise<ClassicFrostProtectionData> {
    const { data } = await this.api.getFrostProtection({ params })
    this.isFrostProtectionAtZoneLevel = isDefined
    return data
  }

  async #getBaseHolidayMode(
    params: ClassicSettingsParams,
    isDefined = true,
  ): Promise<ClassicHolidayModeData> {
    const { data } = await this.api.getHolidayMode({ params })
    this.isHolidayModeAtZoneLevel = isDefined
    return data
  }

  async #getDevicesFrostProtection(): Promise<ClassicFrostProtectionData> {
    return this.#getBaseFrostProtection(
      { id: this.#anyDeviceId, tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getDevicesHolidayMode(): Promise<ClassicHolidayModeData> {
    return this.#getBaseHolidayMode(
      { id: this.#anyDeviceId, tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getFrostProtectionLocation(): Promise<ClassicFrostProtectionLocation> {
    if (this.isFrostProtectionAtZoneLevel === null) {
      await this.getFrostProtection()
    }
    return this.isFrostProtectionAtZoneLevel === true ?
        { [this.frostProtectionLocation]: [this.id] }
      : { DeviceIds: this.#deviceIds }
  }

  async #getHolidayModeLocation(): Promise<ClassicHolidayModeTimeZone[]> {
    if (this.isHolidayModeAtZoneLevel === null) {
      await this.getHolidayMode()
    }
    return this.isHolidayModeAtZoneLevel === true ?
        [{ [this.holidayModeLocation]: [this.id] }]
      : [{ Devices: this.#deviceIds }]
  }

  async #getZoneFrostProtection(): Promise<ClassicFrostProtectionData> {
    return this.#getBaseFrostProtection({
      id: this.id,
      tableName: this.tableName,
    })
  }

  async #getZoneHolidayMode(): Promise<ClassicHolidayModeData> {
    return this.#getBaseHolidayMode({
      id: this.id,
      tableName: this.tableName,
    })
  }
}
