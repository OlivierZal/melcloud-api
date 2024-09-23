import { DateTime } from 'luxon'

import type { BaseFacade } from '.'
import type API from '../services'
import type {
  DateTimeComponents,
  DeviceType,
  ErrorData,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HMTimeZone,
  HolidayModeData,
  HolidayModeLocation,
  ListDevice,
  SettingsParams,
  SuccessData,
  TilesData,
  WifiData,
  ZoneSettings,
} from '../types'
import type { ErrorLog, ErrorLogQuery, IBaseFacade } from './interfaces'

import {
  type AreaModelAny,
  type BuildingModel,
  type DeviceModelAny,
  type FloorModel,
  DeviceModel,
} from '../models'
import { DEFAULT_YEAR, nowISO } from './utils'

const temperatureRange = { max: 16, min: 4 } as const
const TEMPERATURE_GAP = 2

const DEFAULT_LIMIT = 1
const DEFAULT_OFFSET = 0
const INVALID_YEAR = 1

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const handleErrorLogQuery = ({
  from,
  limit,
  offset,
  to,
}: ErrorLogQuery): { fromDate: DateTime; period: number; toDate: DateTime } => {
  const fromDate =
    from !== undefined && from ? DateTime.fromISO(from) : undefined
  const toDate = to !== undefined && to ? DateTime.fromISO(to) : DateTime.now()

  const numberLimit = Number(limit)
  const period = Number.isFinite(numberLimit) ? numberLimit : DEFAULT_LIMIT

  const offsetLimit = Number(offset)
  const daysOffset =
    !fromDate && Number.isFinite(offsetLimit) ? offsetLimit : DEFAULT_OFFSET

  const daysLimit = fromDate ? DEFAULT_LIMIT : period
  const days = daysLimit * daysOffset + daysOffset
  return {
    fromDate: fromDate ?? toDate.minus({ days: days + daysLimit }),
    period,
    toDate: toDate.minus({ days }),
  }
}

export const fetchDevices = <
  T extends ListDevice[keyof typeof DeviceType]['Device'] | ZoneSettings,
>(
  target: (...args: any[]) => Promise<T>,
  _context: unknown,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: BaseFacade<BuildingModel | DeviceModelAny>,
    ...args: unknown[]
  ) {
    await this.api.fetch()
    return target.call(this, ...args)
  }

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
  to?: string,
  days?: number,
): DateTime => {
  const isDays = Boolean(days)
  if ((to === undefined && !isDays) || (to !== undefined && isDays)) {
    throw new Error('Select either end date or days')
  }
  return to === undefined ? startDate.plus({ days }) : DateTime.fromISO(to)
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

  public constructor(api: API, model: T) {
    this.api = api
    this.id = model.id
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

  public async getErrors(query: ErrorLogQuery): Promise<ErrorLog> {
    const { fromDate, period, toDate } = handleErrorLogQuery(query)
    const locale = this.api.language
    const nextToDate = fromDate.minus({ days: 1 })
    return {
      errors: (await this.#getErrors(fromDate, toDate))
        .map(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }) => ({
            date:
              DateTime.fromISO(startDate).year === INVALID_YEAR ?
                ''
              : DateTime.fromISO(startDate, { locale }).toLocaleString(
                  DateTime.DATETIME_MED,
                ),
            device: DeviceModel.getById(deviceId)?.name ?? '',
            error: errorMessage?.trim() ?? '',
          }),
        )
        .filter(({ date, error }) => date && error)
        .reverse(),
      fromDateHuman: fromDate
        .setLocale(locale)
        .toLocaleString(DateTime.DATE_FULL),
      nextFromDate: nextToDate.minus({ days: period }).toISODate() ?? '',
      nextToDate: nextToDate.toISODate() ?? '',
    }
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
    const postData = { DeviceIDs: this.#getDeviceIds() }
    return select === false || !this.#getDeviceIds().includes(select.id) ?
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
        postData: { devices: this.#getDeviceIds(), hour },
      })
    ).data
  }

  public async setFrostProtection({
    enabled,
    max,
    min,
  }: {
    enabled?: boolean
    max: number
    min: number
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
    enabled,
    from,
    to,
  }: {
    days?: number
    enabled?: boolean
    from?: string
    to?: string
  }): Promise<FailureData | SuccessData> {
    const isEnabled = enabled ?? true
    const startDate = isEnabled ? DateTime.fromISO(from ?? nowISO()) : undefined
    const endDate = startDate ? getEndDate(startDate, to, days) : undefined
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

  public async setPower(enabled = true): Promise<boolean> {
    return (
      await this.api.setPower({
        postData: { DeviceIds: this.#getDeviceIds(), Power: enabled },
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

  async #getErrors(
    fromDate: DateTime,
    toDate: DateTime,
    deviceIds: number[] = this.#getDeviceIds(),
  ): Promise<ErrorData[]> {
    const { data } = await this.api.getErrors({
      postData: {
        DeviceIDs: deviceIds,
        FromDate: fromDate.toISODate() ?? DEFAULT_YEAR,
        ToDate: toDate.toISODate() ?? nowISO(),
      },
    })
    if ('AttributeErrors' in data) {
      throw new Error(formatErrors(data.AttributeErrors))
    }
    return data
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
