import type {
  DeviceType,
  EnergyData,
  ErrorData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  HolidayModeData,
  ListDevice,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  WifiData,
} from '../types'
import type API from '../services'
import { DateTime } from 'luxon'
import { DeviceModel } from '../models'
import type { IDeviceFacade } from '.'

export default class<T extends keyof typeof DeviceType>
  implements IDeviceFacade<T>
{
  readonly #api: API

  readonly #id: number

  public constructor(api: API, id: number) {
    this.#api = api
    this.#id = id
  }

  public get model(): DeviceModel<T> {
    const model = DeviceModel.getById(this.#id)
    if (!model) {
      throw new Error('Device not found')
    }
    return model as DeviceModel<T>
  }

  public async fetch(): Promise<ListDevice[T]['Device']> {
    await this.#api.fetchDevices()
    return this.model.data
  }

  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.#api.getDevice({
        params: { buildingId: this.model.buildingId, id: this.model.id },
      })
    ).data as GetDeviceData[T]
  }

  public async getEnergyReport({
    from,
    to,
  }: {
    from: string
    to: string
  }): Promise<EnergyData[T]> {
    return (
      await this.#api.getEnergyReport({
        postData: { DeviceID: this.model.id, FromDate: from, ToDate: to },
      })
    ).data as EnergyData[T]
  }

  public async getErrors({
    from,
    to,
  }: {
    from: string
    to: string
  }): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: {
          DeviceIDs: [this.model.id],
          FromDate: from,
          ToDate: to,
        },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    return (
      await this.#api.getFrostProtection({
        params: { id: this.model.id, tableName: 'DeviceLocation' },
      })
    ).data
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    return (
      await this.#api.getHolidayMode({
        params: { id: this.model.id, tableName: 'DeviceLocation' },
      })
    ).data
  }

  public async getTile(select?: false): Promise<TilesData<null>>
  public async getTile(select: true): Promise<TilesData<T>>
  public async getTile(select = false): Promise<TilesData<T | null>> {
    return select ?
        ((
          await this.#api.getTiles({
            postData: {
              DeviceIDs: [this.model.id],
              SelectedBuilding: this.model.buildingId,
              SelectedDevice: this.model.id,
            },
          })
        ).data as TilesData<T>)
      : (
          await this.#api.getTiles({
            postData: {
              DeviceIDs: [this.model.id],
            },
          })
        ).data
  }

  public async getWifiReport(
    hour: number = DateTime.now().hour,
  ): Promise<WifiData> {
    return (
      await this.#api.getWifiReport({
        postData: { devices: [this.model.id], hour },
      })
    ).data
  }

  public async set(postData: UpdateDeviceData[T]): Promise<SetDeviceData[T]> {
    return (
      await this.#api.setDevice({
        heatPumpType: this.model.type,
        postData: { ...postData, DeviceID: this.model.id },
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
      await this.#api.setFrostProtection({
        postData: {
          DeviceIds: [this.model.id],
          Enabled: enable ?? true,
          MaximumTemperature: max,
          MinimumTemperature: min,
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
      await this.#api.setHolidayMode({
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
          HMTimeZones: [{ Devices: [this.model.id] }],
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
      await this.#api.setPower({
        postData: { DeviceIds: [this.model.id], Power: enable },
      })
    ).data
  }
}
