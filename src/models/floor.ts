import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  type FloorModel,
  type IFloorModel,
} from '.'
import type {
  ErrorData,
  ErrorPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  HolidayModeData,
  HolidayModePostData,
  LocationData,
  SetAtaGroupPostData,
  SetPowerPostData,
  SuccessData,
  TilesData,
} from '../types'
import type API from '../services'

export default class implements IFloorModel {
  public static readonly floors = new Map<number, FloorModel>()

  public readonly buildingId: number

  public readonly id: number

  public readonly name: string

  readonly #api: API

  public constructor(
    api: API,
    { ID: id, BuildingId: buildingId, Name: name }: LocationData,
  ) {
    this.#api = api
    this.id = id
    this.name = name
    this.buildingId = buildingId
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): AreaModel[] {
    return AreaModel.getAll().filter(({ floorId }) => floorId === this.id)
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.buildingId) ?? null
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(({ floorId }) => floorId === this.id)
  }

  public static getAll(): FloorModel[] {
    return Array.from(this.floors.values())
  }

  public static getById(id: number): FloorModel | undefined {
    return this.floors.get(id)
  }

  public static getByName(floorName: string): FloorModel | undefined {
    return this.getAll().find(({ name }) => name === floorName)
  }

  public static upsert(api: API, data: LocationData): void {
    this.floors.set(data.ID, new this(api, data))
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
          params: { id: this.id, tableName: 'Floor' },
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
          params: { id: this.id, tableName: 'Floor' },
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
        postData: { ...postData, Specification: { FloorID: this.id } },
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
          ...(this.building?.data.FPDefined === true ?
            { FloorIds: [this.id] }
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
            this.building?.data.HMDefined === true ?
              { Floors: [this.id] }
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
