import { DateTime } from 'luxon'

import type { DeviceType } from '../constants.ts'
import type { ModelRegistry } from '../models/index.ts'
import type {
  DeviceModel,
  DeviceModelAny,
  Model,
} from '../models/interfaces.ts'
import type { APIAdapter, ErrorLog, ErrorLogQuery } from '../services/index.ts'
import type {
  DateTimeComponents,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HolidayModeData,
  HolidayModeLocation,
  HolidayModeTimeZone,
  SettingsParams,
  SuccessData,
  TilesData,
} from '../types/index.ts'

import { syncDevices, updateDevices } from '../decorators/index.ts'
import { getChartLineOptions, now } from '../utils.ts'

import type {
  Facade,
  FrostProtectionQuery,
  HolidayModeQuery,
  ReportChartLineOptions,
} from './interfaces.ts'

// Minimum 2°C gap between min and max to prevent invalid frost protection ranges
const TEMPERATURE_GAP = 2

const temperatureRange = { max: 16, min: 4 } as const

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
  public readonly id: number

  protected readonly api: APIAdapter

  protected readonly registry: ModelRegistry

  protected isFrostProtectionAtZoneLevel: boolean | null = null

  protected isHolidayModeAtZoneLevel: boolean | null = null

  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public constructor(
    api: APIAdapter,
    registry: ModelRegistry,
    instance: Model,
  ) {
    this.api = api
    this.registry = registry
    ;({ id: this.id } = instance)
  }

  public get name(): string {
    return this.instance.name
  }

  protected get instance(): T {
    const instance = this.model.getById(this.id)
    if (!instance) {
      throw new Error(`${this.tableName} not found`)
    }
    return instance
  }

  get #deviceId(): number {
    const [id] = this.#deviceIds
    if (id === undefined) {
      throw new Error('No device id found')
    }
    return id
  }

  get #deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  get #deviceNames(): string[] {
    return this.devices.map(({ name }) => name)
  }

  public abstract get devices(): DeviceModelAny[]

  @syncDevices()
  @updateDevices()
  public async setPower(value = true): Promise<boolean> {
    const { data: isOn } = await this.api.setPower({
      postData: { DeviceIds: this.#deviceIds, Power: value },
    })
    return isOn
  }

  public async getErrors(query: ErrorLogQuery): Promise<ErrorLog> {
    return this.api.getErrorLog(query, this.#deviceIds)
  }

  public async notifySync({ type }: { type?: DeviceType } = {}): Promise<void> {
    await this.api.onSync?.({ ids: this.#deviceIds, type })
  }

  /*
   * Frost protection can be defined at zone or device level. Try zone first;
   * if unsupported, fall back to device level and cache the result.
   */
  public async getFrostProtection(): Promise<FrostProtectionData> {
    if (this.isFrostProtectionAtZoneLevel === null) {
      try {
        return await this.#getZoneFrostProtection()
      } catch {
        return this.#getDevicesFrostProtection()
      }
    }
    return this.isFrostProtectionAtZoneLevel ?
        this.#getZoneFrostProtection()
      : this.#getDevicesFrostProtection()
  }

  // Same zone-then-device fallback strategy as getFrostProtection
  public async getHolidayMode(): Promise<HolidayModeData> {
    if (this.isHolidayModeAtZoneLevel === null) {
      try {
        return await this.#getZoneHolidayMode()
      } catch {
        return this.#getDevicesHolidayMode()
      }
    }
    return this.isHolidayModeAtZoneLevel ?
        this.#getZoneHolidayMode()
      : this.#getDevicesHolidayMode()
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
  public async getTiles<U extends DeviceType>(
    device: DeviceModel<U>,
  ): Promise<TilesData<U>>
  public async getTiles<U extends DeviceType>(
    device: false | DeviceModel<U> = false,
  ): Promise<TilesData<U | null>> {
    const postData = { DeviceIDs: this.#deviceIds }
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
    return data as TilesData<U>
  }

  public async setFrostProtection({
    enabled,
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
        Enabled: enabled ?? true,
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
