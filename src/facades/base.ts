import { DateTime } from 'luxon'

import type {
  ClassicAPIAdapter,
  ErrorLog,
  ErrorLogQuery,
} from '../api/index.ts'
import type { DeviceType } from '../constants.ts'
import type {
  ClassicRegistry,
  Device,
  DeviceAny,
  Model,
} from '../models/index.ts'
import { syncDevices, updateDevices } from '../decorators/index.ts'
import {
  type DateTimeComponents,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionLocation,
  type HolidayModeData,
  type HolidayModeLocation,
  type HolidayModeTimeZone,
  type SettingsParams,
  type SuccessData,
  type TilesData,
  deviceId,
} from '../types/index.ts'
import { getChartLineOptions, now } from '../utils.ts'
import type {
  Facade,
  FrostProtectionQuery,
  HolidayModeQuery,
  ReportChartLineOptions,
} from './interfaces.ts'

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

const getDateTimeComponents = (date: DateTime | null): DateTimeComponents =>
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
export abstract class BaseFacade<T extends Model> implements Facade {
  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public abstract get devices(): DeviceAny[]

  public readonly id: number

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
      throw new Error(`${this.tableName} with id ${String(this.id)} not found`)
    }
    return instance
  }

  get #deviceId(): number {
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
    instance: Model,
  ) {
    this.api = api
    this.registry = registry
    ;({ id: this.id } = instance)
  }

  @syncDevices()
  @updateDevices()
  public async setPower(isOn = true): Promise<boolean> {
    const { data: isPowered } = await this.api.setPower({
      postData: {
        DeviceIds: this.#deviceIds.map((id) => deviceId(id)),
        Power: isOn,
      },
    })
    return isPowered
  }

  public async getErrors(query: ErrorLogQuery): Promise<ErrorLog> {
    return this.api.getErrorLog(query, this.#deviceIds)
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    return getWithZoneFallback(
      this.isFrostProtectionAtZoneLevel,
      async () => this.#getZoneFrostProtection(),
      async () => this.#getDevicesFrostProtection(),
    )
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
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

  public async getTiles(device?: false): Promise<TilesData<null>>
  public async getTiles<TDeviceType extends DeviceType>(
    device: Device<TDeviceType>,
  ): Promise<TilesData<TDeviceType>>
  public async getTiles<TDeviceType extends DeviceType>(
    device: false | Device<TDeviceType> = false,
  ): Promise<TilesData<TDeviceType | null>> {
    const postData = { DeviceIDs: this.#deviceIds.map((id) => deviceId(id)) }
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
    return data as TilesData<TDeviceType>
  }

  public async notifySync({ type }: { type?: DeviceType } = {}): Promise<void> {
    await this.api.onSync?.({ ids: this.#deviceIds, type })
  }

  public async setFrostProtection({
    isEnabled = true,
    max,
    min,
  }: FrostProtectionQuery): Promise<FailureData | SuccessData> {
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
    const { data } = await this.api.setFrostProtection({
      postData: {
        Enabled: isEnabled,
        MaximumTemperature: newMax,
        MinimumTemperature: newMin,
        ...(await this.#getFrostProtectionLocation()),
      },
    })
    return data
  }

  public async setHolidayMode({ from, to }: HolidayModeQuery = {}): Promise<
    FailureData | SuccessData
  > {
    const isEnabled = to !== undefined
    const startDate = isEnabled ? DateTime.fromISO(from ?? now()) : null
    const endDate = isEnabled ? DateTime.fromISO(to) : null
    const { data } = await this.api.setHolidayMode({
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
    params: SettingsParams,
    isDefined = true,
  ): Promise<FrostProtectionData> {
    const { data } = await this.api.getFrostProtection({ params })
    this.isFrostProtectionAtZoneLevel = isDefined
    return data
  }

  async #getBaseHolidayMode(
    params: SettingsParams,
    isDefined = true,
  ): Promise<HolidayModeData> {
    const { data } = await this.api.getHolidayMode({ params })
    this.isHolidayModeAtZoneLevel = isDefined
    return data
  }

  async #getDevicesFrostProtection(): Promise<FrostProtectionData> {
    return this.#getBaseFrostProtection(
      { id: this.#deviceId, tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getDevicesHolidayMode(): Promise<HolidayModeData> {
    return this.#getBaseHolidayMode(
      { id: this.#deviceId, tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getFrostProtectionLocation(): Promise<FrostProtectionLocation> {
    if (this.isFrostProtectionAtZoneLevel === null) {
      await this.getFrostProtection()
    }
    if (this.isFrostProtectionAtZoneLevel === true) {
      return { [this.frostProtectionLocation]: [this.id] }
    }
    return { DeviceIds: this.#deviceIds }
  }

  async #getHolidayModeLocation(): Promise<HolidayModeTimeZone[]> {
    if (this.isHolidayModeAtZoneLevel === null) {
      await this.getHolidayMode()
    }
    if (this.isHolidayModeAtZoneLevel === true) {
      return [{ [this.holidayModeLocation]: [this.id] }]
    }
    return [{ Devices: this.#deviceIds }]
  }

  async #getZoneFrostProtection(): Promise<FrostProtectionData> {
    return this.#getBaseFrostProtection({
      id: this.id,
      tableName: this.tableName,
    })
  }

  async #getZoneHolidayMode(): Promise<HolidayModeData> {
    return this.#getBaseHolidayMode({
      id: this.id,
      tableName: this.tableName,
    })
  }
}
