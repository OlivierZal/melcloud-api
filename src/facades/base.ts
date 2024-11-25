import { DateTime } from 'luxon'

import { syncDevices } from '../decorators/sync-devices.js'
import { updateDevices } from '../decorators/update-devices.js'
import { now } from '../utils.js'

import type { DeviceType } from '../enums.js'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
} from '../models/interfaces.js'
import type { API } from '../services/api.js'
import type { ErrorLog, ErrorLogQuery } from '../services/interfaces.js'
import type {
  DateTimeComponents,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HMTimeZone,
  HolidayModeData,
  HolidayModeLocation,
  ReportData,
  SettingsParams,
  SuccessData,
  TilesData,
} from '../types/common.js'

import type {
  FrostProtectionQuery,
  HolidayModeQuery,
  IFacade,
} from './interfaces.js'

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

export abstract class BaseFacade<
  T extends IAreaModel | IBuildingModel | IDeviceModelAny | IFloorModel,
> implements IFacade
{
  public readonly id: number

  protected readonly api: API

  protected isFrostProtectionDefined: boolean | null = null

  protected isHolidayModeDefined: boolean | null = null

  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public constructor(api: API, instance: T) {
    this.api = api
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
    return id
  }

  get #deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public abstract get devices(): IDeviceModelAny[]

  public async onSync({
    type,
  }: {
    type?: DeviceType
  } = {}): Promise<void> {
    await this.api.onSync?.({ ids: this.#deviceIds, type })
  }

  @syncDevices()
  @updateDevices()
  public async setPower(value = true): Promise<boolean> {
    return (
      await this.api.setPower({
        postData: { DeviceIds: this.#deviceIds, Power: value },
      })
    ).data
  }

  public async errors(query: ErrorLogQuery): Promise<ErrorLog> {
    return this.api.errorLog(query, this.#deviceIds)
  }

  public async frostProtection(): Promise<FrostProtectionData> {
    if (this.isFrostProtectionDefined === null) {
      try {
        return await this.#getZoneFrostProtection()
      } catch {
        return this.#getDevicesFrostProtection()
      }
    }
    return this.isFrostProtectionDefined ?
        this.#getZoneFrostProtection()
      : this.#getDevicesFrostProtection()
  }

  public async holidayMode(): Promise<HolidayModeData> {
    if (this.isHolidayModeDefined === null) {
      try {
        return await this.#getZoneHolidayMode()
      } catch {
        return this.#getDevicesHolidayMode()
      }
    }
    return this.isHolidayModeDefined ?
        this.#getZoneHolidayMode()
      : this.#getDevicesHolidayMode()
  }

  public async setFrostProtection({
    enabled,
    max,
    min,
  }: FrostProtectionQuery): Promise<FailureData | SuccessData> {
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

  public async setHolidayMode({ from, to }: HolidayModeQuery = {}): Promise<
    FailureData | SuccessData
  > {
    const isEnabled = to !== undefined
    const startDate = isEnabled ? DateTime.fromISO(from ?? now()) : undefined
    const endDate = isEnabled ? DateTime.fromISO(to) : undefined
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

  public async signal(hour = DateTime.now().hour): Promise<ReportData> {
    return (
      await this.api.signal({
        postData: { devices: this.#deviceIds, hour },
      })
    ).data
  }

  public async tiles(select?: false): Promise<TilesData<null>>
  public async tiles<U extends DeviceType>(
    select: IDeviceModel<U>,
  ): Promise<TilesData<U>>
  public async tiles<U extends DeviceType>(
    select: false | IDeviceModel<U> = false,
  ): Promise<TilesData<U | null>> {
    const postData = { DeviceIDs: this.#deviceIds }
    return select === false || !this.#deviceIds.includes(select.id) ?
        (await this.api.tiles({ postData })).data
      : ((
          await this.api.tiles({
            postData: {
              ...postData,
              SelectedBuilding: select.buildingId,
              SelectedDevice: select.id,
            },
          })
        ).data as TilesData<U>)
  }

  async #getBaseFrostProtection(
    params: SettingsParams,
    isDefined = true,
  ): Promise<FrostProtectionData> {
    const { data } = await this.api.frostProtection({ params })
    this.isFrostProtectionDefined = isDefined
    return data
  }

  async #getBaseHolidayMode(
    params: SettingsParams,
    isDefined = true,
  ): Promise<HolidayModeData> {
    const { data } = await this.api.holidayMode({ params })
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
      await this.frostProtection()
    }
    if (this.isFrostProtectionDefined === true) {
      return { [this.frostProtectionLocation]: [this.id] }
    }
    return { DeviceIds: this.#deviceIds }
  }

  async #getHolidayModeLocation(): Promise<HMTimeZone[]> {
    if (this.isHolidayModeDefined === null) {
      await this.holidayMode()
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
