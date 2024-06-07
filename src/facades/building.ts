import type {
  BuildingSettings,
  ErrorData,
  ErrorPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  HolidayModeData,
  HolidayModePostData,
  SetAtaGroupPostData,
  SetPowerPostData,
  SuccessData,
  TilesData,
} from '../types'
import type API from '../services'
import type { BuildingModel } from '../models'
import type { IBuildingFacade } from '.'

export default class implements IBuildingFacade {
  readonly #api: API

  readonly #model: BuildingModel

  public constructor(api: API, building: BuildingModel) {
    this.#api = api
    this.#model = building
  }

  public async fetch(): Promise<BuildingSettings> {
    await this.#api.fetchDevices()
    return this.#model.data
  }

  public async getErrors(
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: { ...postData, DeviceIDs: this.#model.deviceIds },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    try {
      return (
        await this.#api.getFrostProtection({
          params: { id: this.#model.id, tableName: 'Building' },
        })
      ).data
    } catch (_error) {
      const [device] = this.#model.devices
      return (
        await this.#api.getFrostProtection({
          params: { id: device.id, tableName: 'DeviceLocation' },
        })
      ).data
    }
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    try {
      return (
        await this.#api.getHolidayMode({
          params: { id: this.#model.id, tableName: 'Building' },
        })
      ).data
    } catch (_error) {
      const [device] = this.#model.devices
      return (
        await this.#api.getHolidayMode({
          params: { id: device.id, tableName: 'DeviceLocation' },
        })
      ).data
    }
  }

  public async getTiles(): Promise<TilesData<null>> {
    return (
      await this.#api.getTiles({
        postData: { DeviceIDs: this.#model.deviceIds },
      })
    ).data
  }

  public async setAtaGroup(
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setAtaGroup({
        postData: {
          ...postData,
          Specification: { BuildingID: this.#model.id },
        },
      })
    ).data
  }

  public async setFrostProtection(
    postData: Omit<FrostProtectionPostData, 'BuildingIds'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setFrostProtection({
        postData: {
          ...postData,
          ...(this.#model.data.FPDefined ?
            { BuildingIds: [this.#model.id] }
          : { DeviceIds: this.#model.deviceIds }),
        },
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
          HMTimeZones: [
            this.#model.data.HMDefined ?
              { Buildings: [this.#model.id] }
            : { Devices: this.#model.deviceIds },
          ],
        },
      })
    ).data
  }

  public async setPower(
    postData: Omit<SetPowerPostData, 'DeviceIds'>,
  ): Promise<boolean> {
    return (
      await this.#api.setPower({
        postData: { ...postData, DeviceIds: this.#model.deviceIds },
      })
    ).data
  }
}
