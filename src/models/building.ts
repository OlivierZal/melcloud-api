import type {
  BuildingData,
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
import {
  type BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  type IBuildingModel,
} from '.'
import type API from '../services'

export default class implements IBuildingModel {
  public static readonly buildings = new Map<number, BuildingModel>()

  public readonly data: BuildingSettings

  public readonly id: number

  public readonly name: string

  readonly #api: API

  public constructor(api: API, { ID: id, Name: name, ...data }: BuildingData) {
    this.#api = api
    this.id = id
    this.name = name
    this.data = data
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(
      ({ buildingId }) => buildingId === this.id,
    )
  }

  public static getAll(): BuildingModel[] {
    return Array.from(this.buildings.values())
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.buildings.get(id)
  }

  public static getByName(buildingName: string): BuildingModel | undefined {
    return this.getAll().find(({ name }) => name === buildingName)
  }

  public static upsert(api: API, data: BuildingData): BuildingModel {
    const building = new this(api, data)
    this.buildings.delete(data.ID)
    this.buildings.set(data.ID, building)
    return building
  }

  public async fetch(): Promise<BuildingSettings> {
    await this.#api.fetchDevices()
    return this.data
  }

  public async getErrors(
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: { ...postData, DeviceIDs: this.deviceIds },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    try {
      return (
        await this.#api.getFrostProtection({
          params: { id: this.id, tableName: 'Building' },
        })
      ).data
    } catch (_error) {
      const [device] = this.devices
      return device.getFrostProtection()
    }
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    try {
      return (
        await this.#api.getHolidayMode({
          params: { id: this.id, tableName: 'Building' },
        })
      ).data
    } catch (_error) {
      const [device] = this.devices
      return device.getHolidayMode()
    }
  }

  public async getTiles(): Promise<TilesData<null>> {
    return (
      await this.#api.getTiles({
        postData: { DeviceIDs: this.deviceIds },
      })
    ).data
  }

  public async setAtaGroup(
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setAtaGroup({
        postData: { ...postData, Specification: { BuildingID: this.id } },
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
          ...(this.data.FPDefined ?
            { BuildingIds: [this.id] }
          : { DeviceIds: this.deviceIds }),
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
            this.data.HMDefined ?
              { Buildings: [this.id] }
            : { Devices: this.deviceIds },
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
        postData: { ...postData, DeviceIds: this.deviceIds },
      })
    ).data
  }
}
