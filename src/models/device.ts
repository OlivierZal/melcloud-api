import type {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
  IDeviceModel,
} from '.'
import {
  DeviceType,
  type EnergyData,
  type EnergyPostData,
  type ErrorData,
  type ErrorPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type GetDeviceData,
  type HolidayModeData,
  type HolidayModePostData,
  type ListDevice,
  type ListDeviceAny,
  type SetDeviceData,
  type SetDevicePostData,
  type SetPowerPostData,
  type SuccessData,
  type TilesData,
} from '../types'
import API from '../services'

export type DeviceModelAny =
  | DeviceModel<'Ata'>
  | DeviceModel<'Atw'>
  | DeviceModel<'Erv'>

export default class<T extends keyof typeof DeviceType>
  implements IDeviceModel<T>
{
  public readonly areaId: number | null = null

  public readonly buildingId: number

  public readonly data: ListDevice[T]['Device']

  public readonly floorId: number | null = null

  public readonly id: number

  public readonly name: string

  public readonly type: T

  readonly #api: API

  public constructor(
    api: API,
    {
      AreaID: areaId,
      BuildingID: buildingId,
      FloorID: floorId,
      Device: data,
      DeviceID: id,
      DeviceName: name,
      Type: type,
    }: ListDevice[T],
  ) {
    this.#api = api
    this.id = id
    this.name = name
    this.type = DeviceType[type] as T
    this.data = data
    this.buildingId = buildingId
    this.areaId = areaId
    this.floorId = floorId
  }

  public get area(): AreaModel | null {
    if (this.areaId === null) {
      return null
    }
    return API.areas.get(this.areaId) ?? null
  }

  public get building(): BuildingModel | null {
    return API.buildings.get(this.buildingId) ?? null
  }

  public get floor(): FloorModel | null {
    if (this.floorId === null) {
      return null
    }
    return API.floors.get(this.floorId) ?? null
  }

  public static getAll(): DeviceModelAny[] {
    return Array.from(API.devices.values())
  }

  public static getById(id: number): DeviceModelAny | undefined {
    return API.devices.get(id)
  }

  public static getByName(deviceName: string): DeviceModelAny | undefined {
    return this.getAll().find(({ name }) => name === deviceName)
  }

  public static getByType(
    deviceType: keyof typeof DeviceType,
  ): DeviceModelAny[] {
    return this.getAll().filter(({ type }) => type === deviceType)
  }

  public static upsert(api: API, data: ListDeviceAny): DeviceModelAny {
    const device = new this(api, data) as DeviceModelAny
    API.devices.delete(data.DeviceID)
    API.devices.set(data.DeviceID, device)
    return device
  }

  public async fetch(): Promise<ListDevice[T]['Device']> {
    await this.#api.fetchDevices()
    return this.data
  }

  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.#api.getDevice({
        params: { buildingId: this.buildingId, id: this.id },
      })
    ).data as GetDeviceData[T]
  }

  public async getEnergyReport(
    postData: Omit<EnergyPostData, 'DeviceID'>,
  ): Promise<EnergyData[T]> {
    return (
      await this.#api.getEnergyReport({
        postData: { ...postData, DeviceID: this.id },
      })
    ).data as EnergyData[T]
  }

  public async getErrors(
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ): Promise<ErrorData[] | FailureData> {
    return (
      await this.#api.getErrors({
        postData: { ...postData, DeviceIDs: [this.id] },
      })
    ).data
  }

  public async getFrostProtection(): Promise<FrostProtectionData> {
    return (
      await this.#api.getFrostProtection({
        params: { id: this.id, tableName: 'DeviceLocation' },
      })
    ).data
  }

  public async getHolidayMode(): Promise<HolidayModeData> {
    return (
      await this.#api.getHolidayMode({
        params: { id: this.id, tableName: 'DeviceLocation' },
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
              DeviceIDs: [this.id],
              SelectedBuilding: this.buildingId,
              SelectedDevice: this.id,
            },
          })
        ).data as TilesData<T>)
      : (
          await this.#api.getTiles({
            postData: {
              DeviceIDs: [this.id],
            },
          })
        ).data
  }

  public async set(
    postData: Omit<SetDevicePostData[T], 'DeviceID'>,
  ): Promise<SetDeviceData[T]> {
    return (
      await this.#api.setDevice({
        heatPumpType: this.type,
        postData: { ...postData, DeviceID: this.id },
      })
    ).data
  }

  public async setFrostProtection(
    postData: Omit<FrostProtectionPostData, 'DeviceIds'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setFrostProtection({
        postData: { ...postData, DeviceIds: [this.id] },
      })
    ).data
  }

  public async setHolidayMode(
    postData: Omit<HolidayModePostData, 'HMTimeZones'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.#api.setHolidayMode({
        postData: { ...postData, HMTimeZones: [{ Devices: [this.id] }] },
      })
    ).data
  }

  public async setPower(
    postData: Omit<SetPowerPostData, 'DeviceIds'>,
  ): Promise<boolean> {
    return (
      await this.#api.setPower({
        postData: { ...postData, DeviceIds: [this.id] },
      })
    ).data
  }
}
