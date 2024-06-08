import type {
  DeviceType,
  EnergyData,
  EnergyPostData,
  ErrorData,
  ErrorPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  GetDeviceData,
  HolidayModeData,
  HolidayModePostData,
  ListDevice,
  SetDeviceData,
  SetPowerPostData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
} from '../types'
import type API from '../services'
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

  public async getEnergyReport(
    postData: Omit<EnergyPostData, 'DeviceID'>,
  ): Promise<EnergyData[T]> {
    return (
      await this.#api.getEnergyReport({
        postData: { ...postData, DeviceID: this.model.id },
      })
    ).data as EnergyData[T]
  }

  public async getErrors(
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: { ...postData, DeviceIDs: [this.model.id] },
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

  public async set(postData: UpdateDeviceData[T]): Promise<SetDeviceData[T]> {
    return (
      await this.#api.setDevice({
        heatPumpType: this.model.type,
        postData: { ...postData, DeviceID: this.model.id },
      })
    ).data
  }

  public async setFrostProtection(
    postData: Omit<FrostProtectionPostData, 'DeviceIds'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setFrostProtection({
        postData: { ...postData, DeviceIds: [this.model.id] },
      })
    ).data
  }

  public async setHolidayMode(
    postData: Omit<HolidayModePostData, 'HMTimeZones'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setHolidayMode({
        postData: {
          ...postData,
          HMTimeZones: [{ Devices: [this.model.id] }],
        },
      })
    ).data
  }

  public async setPower(
    postData: Omit<SetPowerPostData, 'DeviceIds'>,
  ): Promise<boolean> {
    return (
      await this.#api.setPower({
        postData: { ...postData, DeviceIds: [this.model.id] },
      })
    ).data
  }
}
