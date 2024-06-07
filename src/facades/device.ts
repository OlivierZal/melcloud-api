import type { DeviceFacade, IDeviceFacade } from '.'
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
  SetDevicePostData,
  SetPowerPostData,
  SuccessData,
  TilesData,
} from '../types'
import type API from '../services'
import type { DeviceModel } from '../models'

export type DeviceFacadeAny =
  | DeviceFacade<'Ata'>
  | DeviceFacade<'Atw'>
  | DeviceFacade<'Erv'>

export default class<T extends keyof typeof DeviceType>
  implements IDeviceFacade<T>
{
  readonly #api: API

  readonly #device: DeviceModel<T>

  public constructor(api: API, device: DeviceModel<T>) {
    this.#api = api
    this.#device = device
  }

  public async fetch(): Promise<ListDevice[T]['Device']> {
    await this.#api.fetchDevices()
    return this.#device.data
  }

  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.#api.getDevice({
        params: { buildingId: this.#device.buildingId, id: this.#device.id },
      })
    ).data as GetDeviceData[T]
  }

  public async getEnergyReport(
    postData: Omit<EnergyPostData, 'DeviceID'>,
  ): Promise<EnergyData[T]> {
    return (
      await this.#api.getEnergyReport({
        postData: { ...postData, DeviceID: this.#device.id },
      })
    ).data as EnergyData[T]
  }

  public async getErrors(
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: { ...postData, DeviceIDs: [this.#device.id] },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    return (
      await this.#api.getFrostProtection({
        params: { id: this.#device.id, tableName: 'DeviceLocation' },
      })
    ).data
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    return (
      await this.#api.getHolidayMode({
        params: { id: this.#device.id, tableName: 'DeviceLocation' },
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
              DeviceIDs: [this.#device.id],
              SelectedBuilding: this.#device.buildingId,
              SelectedDevice: this.#device.id,
            },
          })
        ).data as TilesData<T>)
      : (
          await this.#api.getTiles({
            postData: {
              DeviceIDs: [this.#device.id],
            },
          })
        ).data
  }

  public async set(
    postData: Omit<SetDevicePostData[T], 'DeviceID'>,
  ): Promise<SetDeviceData[T]> {
    return (
      await this.#api.setDevice({
        heatPumpType: this.#device.type,
        postData: { ...postData, DeviceID: this.#device.id },
      })
    ).data
  }

  public async setFrostProtection(
    postData: Omit<FrostProtectionPostData, 'DeviceIds'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setFrostProtection({
        postData: { ...postData, DeviceIds: [this.#device.id] },
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
          HMTimeZones: [{ Devices: [this.#device.id] }],
        },
      })
    ).data
  }

  public async setPower(
    postData: Omit<SetPowerPostData, 'DeviceIds'>,
  ): Promise<boolean> {
    return (
      await this.#api.setPower({
        postData: { ...postData, DeviceIds: [this.#device.id] },
      })
    ).data
  }
}
