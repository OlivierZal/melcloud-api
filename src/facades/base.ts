import type {
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '../models'
import type {
  DateTimeComponents,
  ErrorData,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HMTimeZone,
  HolidayModeData,
  HolidayModeLocation,
  SettingsParams,
  SuccessData,
  WifiData,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import { DateTime } from 'luxon'
import type { IBaseFacade } from './interfaces'

const MIN_TEMPERATURE_MIN = 4
const MIN_TEMPERATURE_MAX = 14
const MAX_TEMPERATURE_MIN = 6
const MAX_TEMPERATURE_MAX = 16
const MIN_MAX_GAP = 2

const getDateTimeComponents = (
  date: DateTime | null,
): DateTimeComponents | null =>
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
  to?: string | null,
  days?: number,
): DateTime | null => {
  if (
    typeof to === 'undefined' ||
    to === null ||
    typeof days === 'undefined' ||
    !days
  ) {
    throw new Error('End date is missing')
  }
  return days ? startDate.plus({ days }) : DateTime.fromISO(to)
}

export default abstract class<
  T extends AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
> implements IBaseFacade
{
  public readonly id: number

  protected isFrostProtectionDefined: boolean | null = null

  protected isHolidayModeDefined: boolean | null = null

  protected readonly api: API

  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly modelClass: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public constructor(api: API, id: number) {
    this.api = api
    this.id = id
  }

  public get name(): string {
    return this.model.name
  }

  protected get model(): T {
    const model = this.modelClass.getById(this.id)
    if (!model) {
      throw new Error(`${this.tableName} not found`)
    }
    return model
  }

  public async getErrors({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }): Promise<ErrorData[] | FailureData> {
    return (
      await this.api.getErrors({
        postData: {
          DeviceIDs: this.#getDeviceIds(),
          FromDate: from ?? YEAR_1970,
          ToDate: to ?? nowISO(),
        },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    if (this.isFrostProtectionDefined === null) {
      try {
        return await this.#getLocalFrostProtection()
      } catch (_error) {
        return this.#getDevicesFrostProtection()
      }
    }
    return this.isFrostProtectionDefined ?
        this.#getLocalFrostProtection()
      : this.#getDevicesFrostProtection()
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    if (this.isHolidayModeDefined === null) {
      try {
        return await this.#getLocalHolidayMode()
      } catch (_error) {
        return this.#getDevicesHolidayMode()
      }
    }
    return this.isHolidayModeDefined ?
        this.#getLocalHolidayMode()
      : this.#getDevicesHolidayMode()
  }

  public async getWifiReport(
    hour: number = DateTime.now().hour,
  ): Promise<WifiData> {
    return (
      await this.api.getWifiReport({
        postData: { devices: this.#getDeviceIds(), hour },
      })
    ).data
  }

  public async setFrostProtection({
    enable,
    max,
    min,
  }: {
    enable?: boolean
    max: number
    min: number
  }): Promise<FailureData | SuccessData> {
    let [newMin, newMax] = min > max ? [max, min] : [min, max]
    newMin = Math.max(
      MIN_TEMPERATURE_MIN,
      Math.min(newMin, MIN_TEMPERATURE_MAX),
    )
    newMax = Math.max(
      MAX_TEMPERATURE_MIN,
      Math.min(newMax, MAX_TEMPERATURE_MAX),
    )
    if (newMax - newMin < MIN_MAX_GAP) {
      newMax = newMin + MIN_MAX_GAP
    }
    return (
      await this.api.setFrostProtection({
        postData: {
          Enabled: enable ?? true,
          MaximumTemperature: newMax,
          MinimumTemperature: newMin,
          ...(await this.#getFrostProtectionLocation()),
        },
      })
    ).data
  }

  public async setHolidayMode({
    days,
    enable,
    from,
    to,
  }: {
    days?: number
    enable?: boolean
    from?: string | null
    to?: string | null
  }): Promise<FailureData | SuccessData> {
    const isEnabled = enable ?? true
    const startDate = isEnabled ? DateTime.fromISO(from ?? nowISO()) : null
    const endDate = startDate ? getEndDate(startDate, to, days) : null
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

  public async setPower(enable = true): Promise<boolean> {
    return (
      await this.api.setPower({
        postData: { DeviceIds: this.#getDeviceIds(), Power: enable },
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

  #getDeviceId(): number {
    if ('devices' in this.model) {
      const [{ id }] = this.model.devices
      return id
    }
    return this.id
  }

  #getDeviceIds(): number[] {
    return 'deviceIds' in this.model ? this.model.deviceIds : [this.id]
  }

  async #getDevicesFrostProtection(): Promise<FrostProtectionData> {
    return this.#getBaseFrostProtection(
      { id: this.#getDeviceId(), tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getDevicesHolidayMode(): Promise<HolidayModeData> {
    return this.#getBaseHolidayMode(
      { id: this.#getDeviceId(), tableName: 'DeviceLocation' },
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
    return { DeviceIds: this.#getDeviceIds() }
  }

  async #getHolidayModeLocation(): Promise<HMTimeZone[]> {
    if (this.isHolidayModeDefined === null) {
      await this.getHolidayMode()
    }
    if (this.isHolidayModeDefined === true) {
      return [{ [this.holidayModeLocation]: [this.id] }]
    }
    return [{ Devices: this.#getDeviceIds() }]
  }

  async #getLocalFrostProtection(): Promise<FrostProtectionData> {
    return this.#getBaseFrostProtection({
      id: this.id,
      tableName: this.tableName,
    })
  }

  async #getLocalHolidayMode(): Promise<HolidayModeData> {
    return this.#getBaseHolidayMode({
      id: this.id,
      tableName: this.tableName,
    })
  }
}
