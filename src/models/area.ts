import type {
  AreaModel,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
  IAreaModel,
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
import API from '../services'

export default class implements IAreaModel {
  public readonly buildingId: number

  public readonly floorId: number | null

  public readonly id: number

  public readonly name: string

  readonly #api: API

  public constructor(
    api: API,
    {
      ID: id,
      BuildingId: buildingId,
      FloorId: floorId,
      Name: name,
    }: LocationData & {
      readonly FloorId: number | null
    },
  ) {
    this.#api = api
    this.id = id
    this.name = name
    this.buildingId = buildingId
    this.floorId = floorId
  }

  public get building(): BuildingModel | null {
    return API.buildings.get(this.buildingId) ?? null
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return Array.from(API.devices.values()).filter(
      ({ areaId }) => areaId === this.id,
    )
  }

  public get floor(): FloorModel | null {
    if (this.floorId === null) {
      return null
    }
    return API.floors.get(this.floorId) ?? null
  }

  public static getAll(): AreaModel[] {
    return Array.from(API.areas.values())
  }

  public static getById(id: number): AreaModel | undefined {
    return API.areas.get(id)
  }

  public static getByName(areaName: string): AreaModel | undefined {
    return this.getAll().find(({ name }) => name === areaName)
  }

  public static upsert(
    api: API,
    data: LocationData & { readonly FloorId: number | null },
  ): AreaModel {
    const area = new this(api, data)
    API.areas.delete(data.ID)
    API.areas.set(data.ID, area)
    return area
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
          params: { id: this.id, tableName: 'Area' },
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
          params: { id: this.id, tableName: 'Area' },
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
        postData: { ...postData, Specification: { AreaID: this.id } },
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
            { AreaIds: [this.id] }
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
              { Areas: [this.id] }
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
