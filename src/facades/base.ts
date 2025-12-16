import { DateTime } from 'luxon'

import type { DeviceType } from '../enums.ts'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
} from '../models/index.ts'
import type { ErrorLog, ErrorLogQuery, IAPI } from '../services/index.ts'
import type {
  DateTimeComponents,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HMTimeZone,
  HolidayModeData,
  HolidayModeLocation,
  SettingsParams,
  SuccessData,
  TilesData,
} from '../types/index.ts'

import { syncDevices, updateDevices } from '../decorators/index.ts'
import { getChartLineOptions, now } from '../utils.ts'

import type {
  FrostProtectionQuery,
  HolidayModeQuery,
  IFacade,
  ReportChartLineOptions,
} from './interfaces.ts'

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

export abstract class BaseFacade<
  T extends IAreaModel | IBuildingModel | IDeviceModelAny | IFloorModel,
> implements IFacade {
  public readonly id: number

  protected readonly api: IAPI

  protected isFrostProtectionDefined: boolean | null = null

  protected isHolidayModeDefined: boolean | null = null

  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public constructor(api: IAPI, instance: T) {
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

  public abstract get devices(): IDeviceModelAny[]

  public async onSync({ type }: { type?: DeviceType } = {}): Promise<void> {
    await this.api.onSync?.({ ids: this.#deviceIds, type })
  }

  @syncDevices()
  @updateDevices()
  public async setPower(value = true): Promise<boolean> {
    const { data: isOn } = await this.api.setPower({
      postData: { DeviceIds: this.#deviceIds, Power: value },
    })
    return isOn
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

  public async signal(
    hour = DateTime.now().hour,
  ): Promise<ReportChartLineOptions> {
    const { data } = await this.api.signal({
      postData: { devices: this.#deviceIds, hour },
    })
    return getChartLineOptions(data, this.#deviceNames, 'dBm')
  }

  public async tiles(select?: false): Promise<TilesData<null>>
  public async tiles<U extends DeviceType>(
    select: IDeviceModel<U>,
  ): Promise<TilesData<U>>
  public async tiles<U extends DeviceType>(
    select: false | IDeviceModel<U> = false,
  ): Promise<TilesData<U | null>> {
    const postData = { DeviceIDs: this.#deviceIds }
    if (select === false || !this.#deviceIds.includes(select.id)) {
      const { data } = await this.api.tiles({ postData })
      return data
    }
    const { data } = await this.api.tiles({
      postData: {
        ...postData,
        SelectedBuilding: select.buildingId,
        SelectedDevice: select.id,
      },
    })
    return data as TilesData<U>
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
