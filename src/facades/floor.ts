import type {
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
import type { FloorModel } from '../models'
import type { IFloorFacade } from '.'

export default class implements IFloorFacade {
  readonly #api: API

  readonly #floor: FloorModel

  public constructor(api: API, floor: FloorModel) {
    this.#api = api
    this.#floor = floor
  }

  public async getErrors(
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: { ...postData, DeviceIDs: this.#floor.deviceIds },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    try {
      return (
        await this.#api.getFrostProtection({
          params: { id: this.#floor.id, tableName: 'Floor' },
        })
      ).data
    } catch (_error) {
      const [device] = this.#floor.devices
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
          params: { id: this.#floor.id, tableName: 'Floor' },
        })
      ).data
    } catch (_error) {
      const [device] = this.#floor.devices
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
        postData: { DeviceIDs: this.#floor.deviceIds },
      })
    ).data
  }

  public async setAtaGroup(
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setAtaGroup({
        postData: { ...postData, Specification: { FloorID: this.#floor.id } },
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
          ...(this.#floor.building?.data.FPDefined === true ?
            { FloorIds: [this.#floor.id] }
          : { DeviceIds: this.#floor.deviceIds }),
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
            this.#floor.building?.data.HMDefined === true ?
              { Floors: [this.#floor.id] }
            : { Devices: this.#floor.deviceIds },
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
        postData: { ...postData, DeviceIds: this.#floor.deviceIds },
      })
    ).data
  }
}
