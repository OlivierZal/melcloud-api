import { DateTime } from 'luxon'

import { syncDevices, updateDevices } from '../decorators'

import { now } from './utils'

import type {
  AreaModelAny,
  BuildingModel,
  DeviceModel,
  DeviceModelAny,
  FloorModel,
} from '../models'
import type { API } from '../services'
import type {
  DateTimeComponents,
  DeviceType,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HMTimeZone,
  HolidayModeData,
  HolidayModeLocation,
  SettingsParams,
  SuccessData,
  TilesData,
  WifiData,
} from '../types'

import type { ErrorLog, ErrorLogQuery, IBaseFacade } from './interfaces'

import type { FacadeManager } from '.'

const temperatureRange = { max: 16, min: 4 } as const
const TEMPERATURE_GAP = 2

const getDateTimeComponents = (date?: DateTime): DateTimeComponents =>
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

const getEndDate = (
  startDate: DateTime,
  endDateInfo: number | string,
): DateTime =>
  typeof endDateInfo === 'number' ?
    startDate.plus({ days: endDateInfo })
  : DateTime.fromISO(endDateInfo)

export abstract class BaseFacade<
  T extends AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
> implements IBaseFacade
{
  public readonly api: API

  public readonly id: number

  protected isFrostProtectionDefined: boolean | null = null

  protected isHolidayModeDefined: boolean | null = null

  readonly #manager: FacadeManager

  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public constructor(manager: FacadeManager, instance: T) {
    this.#manager = manager
    ;({ api: this.api } = manager)
    ;({ id: this.id } = instance)
  }

  public get devices(): DeviceModelAny[] {
    return 'devices' in this.instance ? this.instance.devices : [this.instance]
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
    return id
  }

  get #deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  @syncDevices
  @updateDevices()
  public async setPower(enabled = true): Promise<boolean> {
    return (
      await this.api.setPower({
        postData: { DeviceIds: this.#deviceIds, Power: enabled },
      })
    ).data
  }

  public async getErrors(query: ErrorLogQuery): Promise<ErrorLog> {
    return this.#manager.getErrors(query, this.#deviceIds)
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    if (this.isFrostProtectionDefined === null) {
      try {
        return await this.#getZoneFrostProtection()
      } catch (_error) {
        return this.#getDevicesFrostProtection()
      }
    }
    return this.isFrostProtectionDefined ?
        this.#getZoneFrostProtection()
      : this.#getDevicesFrostProtection()
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    if (this.isHolidayModeDefined === null) {
      try {
        return await this.#getZoneHolidayMode()
      } catch (_error) {
        return this.#getDevicesHolidayMode()
      }
    }
    return this.isHolidayModeDefined ?
        this.#getZoneHolidayMode()
      : this.#getDevicesHolidayMode()
  }
  public async getTiles(select?: false): Promise<TilesData<null>>
  public async getTiles<K extends keyof typeof DeviceType>(
    select: DeviceModel<K>,
  ): Promise<TilesData<K>>

  public async getTiles<K extends keyof typeof DeviceType>(
    select: false | DeviceModel<K> = false,
  ): Promise<TilesData<K | null>> {
    const postData = { DeviceIDs: this.#deviceIds }
    return select === false || !this.#deviceIds.includes(select.id) ?
        (await this.api.getTiles({ postData })).data
      : ((
          await this.api.getTiles({
            postData: {
              ...postData,
              SelectedBuilding: select.buildingId,
              SelectedDevice: select.id,
            },
          })
        ).data as TilesData<K>)
  }

  public async getWifiReport(
    hour: number = DateTime.now().hour,
  ): Promise<WifiData> {
    return (
      await this.api.getWifiReport({
        postData: { devices: this.#deviceIds, hour },
      })
    ).data
  }

  public async setFrostProtection({
    enabled,
    max,
    min,
  }: {
    max: number
    min: number
    enabled?: boolean
  }): Promise<FailureData | SuccessData> {
    let [newMin, newMax] = min > max ? [max, min] : [min, max]
    newMin = Math.max(
      temperatureRange.min,
      Math.min(newMin, temperatureRange.max - TEMPERATURE_GAP),
    )
    newMax = Math.min(
      temperatureRange.max,
      Math.max(newMax, temperatureRange.min + TEMPERATURE_GAP),
    )
    if (newMax - newMin < TEMPERATURE_GAP) {
      newMax = newMin + TEMPERATURE_GAP
    }
    return (
      await this.api.setFrostProtection({
        postData: {
          Enabled: enabled ?? true,
          MaximumTemperature: newMax,
          MinimumTemperature: newMin,
          ...(await this.#getFrostProtectionLocation()),
        },
      })
    ).data
  }

  public async setHolidayMode({
    days,
    from,
    to,
  }: {
    days?: number
    from?: string
    to?: string | null
  } = {}): Promise<FailureData | SuccessData> {
    const isEnabled = Boolean(days) || Boolean(to)
    const startDate = isEnabled ? DateTime.fromISO(from ?? now()) : undefined
    const endDate =
      startDate ?
        getEndDate(startDate, days ?? (to as number | string))
      : undefined
    return (
      await this.api.setHolidayMode({
        postData: {
          Enabled: isEnabled,
          EndDate: getDateTimeComponents(endDate),
          HMTimeZones: await this.#getHolidayModeLocation(),
          StartDate: getDateTimeComponents(startDate),
        },
      })
    ).data
  }

  async #getBaseFrostProtection(
    params: SettingsParams,
    isDefined = true,
  ): Promise<FrostProtectionData> {
    const { data } = await this.api.getFrostProtection({ params })
    this.isFrostProtectionDefined = isDefined
    return data
  }

  async #getBaseHolidayMode(
    params: SettingsParams,
    isDefined = true,
  ): Promise<HolidayModeData> {
    const { data } = await this.api.getHolidayMode({ params })
    this.isHolidayModeDefined = isDefined
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
    if (this.isFrostProtectionDefined === null) {
      await this.getFrostProtection()
    }
    if (this.isFrostProtectionDefined === true) {
      return { [this.frostProtectionLocation]: [this.id] }
    }
    return { DeviceIds: this.#deviceIds }
  }

  async #getHolidayModeLocation(): Promise<HMTimeZone[]> {
    if (this.isHolidayModeDefined === null) {
      await this.getHolidayMode()
    }
    if (this.isHolidayModeDefined === true) {
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
