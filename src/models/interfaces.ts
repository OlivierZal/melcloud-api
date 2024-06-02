import type { AreaModel, BuildingModel, DeviceModelAny, FloorModel } from '.'
import type {
  BuildingSettings,
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
  SetAtaGroupPostData,
  SetDeviceData,
  SetDevicePostData,
  SetPowerPostData,
  SuccessData,
  TilesData,
} from '../types'

export interface IBaseModel {
  getErrors: (
    postData: Omit<ErrorPostData, 'DeviceIDs'>,
  ) => Promise<ErrorData[] | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  setFrostProtection: (
    postData: Omit<FrostProtectionPostData, 'BuildingIds'>,
  ) => Promise<FailureData | SuccessData>
  setHolidayMode: (
    postData: Omit<HolidayModePostData, 'HMTimeZones'>,
  ) => Promise<FailureData | SuccessData>
  setPower: (postData: Omit<SetPowerPostData, 'DeviceIds'>) => Promise<boolean>
  readonly id: number
  readonly name: string
}

interface IBaseSubBuildingModel {
  building: BuildingModel | null
  readonly buildingId: number
}

interface IBaseSuperDeviceModel {
  deviceIds: number[]
  devices: DeviceModelAny[]
  getTiles: () => Promise<TilesData<null>>
  setAtaGroup: (
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ) => Promise<FailureData | SuccessData>
}

export interface IBuildingModel extends IBaseModel, IBaseSuperDeviceModel {
  fetch: () => Promise<BuildingSettings>
  readonly data: BuildingSettings
}

export interface IAreaModel
  extends IBaseModel,
    IBaseSuperDeviceModel,
    IBaseSubBuildingModel {
  floor: FloorModel | null
  readonly floorId: number | null
}

export interface IFloorModel
  extends IBaseModel,
    IBaseSuperDeviceModel,
    IBaseSubBuildingModel {
  areaIds: number[]
  areas: AreaModel[]
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseModel,
    IBaseSubBuildingModel {
  area: AreaModel | null
  fetch: () => Promise<ListDevice[T]['Device']>
  floor: FloorModel | null
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: (
    postData: Omit<EnergyPostData, 'DeviceID'>,
  ) => Promise<EnergyData[T]>
  getTile: ((select?: false) => Promise<TilesData<null>>) &
    ((select: true) => Promise<TilesData<T>>)
  set: (
    postData: Omit<SetDevicePostData[T], 'DeviceID'>,
  ) => Promise<SetDeviceData[T]>
  readonly areaId: number | null
  readonly data: ListDevice[T]['Device']
  readonly floorId: number | null
  readonly type: T
}
