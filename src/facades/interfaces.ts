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
  SetPowerPostData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
} from '../types'

export interface IBaseFacade {
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
}

interface IBaseSuperDeviceFacade {
  getTiles: () => Promise<TilesData<null>>
  setAtaGroup: (
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade extends IBaseFacade, IBaseSuperDeviceFacade {
  fetch: () => Promise<BuildingSettings>
}

export interface IAreaFacade extends IBaseFacade, IBaseSuperDeviceFacade {}

export interface IFloorFacade extends IBaseFacade, IBaseSuperDeviceFacade {}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade {
  fetch: () => Promise<ListDevice[T]['Device']>
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: (
    postData: Omit<EnergyPostData, 'DeviceID'>,
  ) => Promise<EnergyData[T]>
  getTile: ((select?: false) => Promise<TilesData<null>>) &
    ((select: true) => Promise<TilesData<T>>)
  set: (postData: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
}
