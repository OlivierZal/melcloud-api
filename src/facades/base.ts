import type {
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '../models'
import type {
  BuildingSettings,
  ErrorData,
  FailureData,
  FrostProtectionData,
  FrostProtectionLocation,
  HolidayModeData,
  HolidayModeLocation,
  SettingsParams,
  SuccessData,
  WifiData,
} from '../types'
import type API from '../services'
import { DateTime } from 'luxon'
import type { IBaseFacade } from '.'

export default abstract class<
  T extends AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
> implements IBaseFacade
{
  protected readonly api: API

  readonly #id: number

  protected abstract readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof HolidayModeLocation

  protected abstract readonly modelClass: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: SettingsParams['tableName']

  public constructor(api: API, id: number) {
    this.api = api
    this.#id = id
  }

  public get model(): T {
    const model = this.modelClass.getById(this.#id)
    if (!model) {
      throw new Error(`${this.tableName} not found`)
    }
    return model
  }

  public async getErrors({
    from,
    to,
  }: {
    from: string
    to: string
  }): Promise<ErrorData[] | FailureData> {
    return (
      await this.api.getErrors({
        postData: {
          DeviceIDs: this.#getDeviceIds(),
          FromDate: from,
          ToDate: to,
        },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    try {
      return (
        await this.api.getFrostProtection({
          params: { id: this.model.id, tableName: this.tableName },
        })
      ).data
    } catch (_error) {
      return (
        await this.api.getFrostProtection({
          params: { id: this.#getDeviceId(), tableName: 'DeviceLocation' },
        })
      ).data
    }
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    try {
      return (
        await this.api.getHolidayMode({
          params: { id: this.model.id, tableName: this.tableName },
        })
      ).data
    } catch (_error) {
      return (
        await this.api.getHolidayMode({
          params: { id: this.#getDeviceId(), tableName: 'DeviceLocation' },
        })
      ).data
    }
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
    return (
      await this.api.setFrostProtection({
        postData: {
          Enabled: enable ?? true,
          MaximumTemperature: max,
          MinimumTemperature: min,
          ...(this.#getBuildingData().FPDefined ?
            { [this.frostProtectionLocation]: [this.model.id] }
          : { DeviceIds: this.#getDeviceIds() }),
        },
      })
    ).data
  }

  public async setHolidayMode({
    enable,
    from,
    to,
  }: {
    enable?: boolean
    from: string
    to: string
  }): Promise<FailureData | SuccessData> {
    const isEnabled = enable ?? true
    const startDate = isEnabled ? DateTime.fromISO(from) : null
    const endDate = isEnabled ? DateTime.fromISO(to) : null
    return (
      await this.api.setHolidayMode({
        postData: {
          Enabled: isEnabled,
          EndDate:
            endDate ?
              {
                Day: endDate.day,
                Hour: endDate.hour,
                Minute: endDate.minute,
                Month: endDate.month,
                Second: endDate.second,
                Year: endDate.year,
              }
            : null,
          HMTimeZones: [
            this.#getBuildingData().HMDefined ?
              { [this.holidayModeLocation]: [this.model.id] }
            : { Devices: this.#getDeviceIds() },
          ],
          StartDate:
            startDate ?
              {
                Day: startDate.day,
                Hour: startDate.hour,
                Minute: startDate.minute,
                Month: startDate.month,
                Second: startDate.second,
                Year: startDate.year,
              }
            : null,
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

  #getBuildingData(): BuildingSettings {
    if ('building' in this.model) {
      if (!this.model.building) {
        throw new Error('Building not found')
      }
      return this.model.building.data
    }
    return this.model.data
  }

  #getDeviceId(): number {
    if ('devices' in this.model) {
      const [device] = this.model.devices
      return device.id
    }
    return this.model.id
  }

  #getDeviceIds(): number[] {
    if ('deviceIds' in this.model) {
      return this.model.deviceIds
    }
    return [this.model.id]
  }
}
