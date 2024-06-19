import type {
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '../models'
import type {
  BuildingData,
  BuildingSettings,
  DeviceType,
  EnergyData,
  ErrorData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  HolidayModeData,
  ListDevice,
  NonFlagsKeyOf,
  SetAtaGroupPostData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  WifiData,
} from '../types'

export interface IBaseFacade<
  T extends AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
> {
  getErrors: ({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }) => Promise<ErrorData[] | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  getWifiReport: (hour: number) => Promise<WifiData>
  model: T
  name: string
  setFrostProtection: ({
    enable,
    max,
    min,
  }: {
    enable?: boolean
    max: number
    min: number
  }) => Promise<FailureData | SuccessData>
  setHolidayMode: (({
    enable,
    from,
    to,
  }: {
    from?: null
    to?: null
    enable: false
  }) => Promise<FailureData | SuccessData>) &
    (({
      enable,
      from,
      to,
    }: {
      enable?: true
      from?: string | null
      to: string
    }) => Promise<FailureData | SuccessData>) &
    (({
      enable,
      from,
      days,
    }: {
      enable?: true
      from?: string | null
      days: number
    }) => Promise<FailureData | SuccessData>)
  setPower: (enable?: boolean) => Promise<boolean>
}

export interface IBaseSuperDeviceFacade
  extends IBaseFacade<AreaModelAny | BuildingModel | FloorModel> {
  getAta: () => SetAtaGroupPostData['State']
  getTiles: () => Promise<TilesData<null>>
  setAta: (
    postData: SetAtaGroupPostData['State'],
  ) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade extends IBaseSuperDeviceFacade {
  actualData: () => Promise<BuildingData>
  fetch: () => Promise<BuildingSettings>
  settings: BuildingSettings
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade<DeviceModelAny> {
  data: ListDevice[T]['Device']
  fetch: () => Promise<ListDevice[T]['Device']>
  flags: Record<NonFlagsKeyOf<UpdateDeviceData[T]>, number>
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: ({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }) => Promise<EnergyData[T]>
  getTile: ((select?: false) => Promise<TilesData<null>>) &
    ((select: true) => Promise<TilesData<T>>)
  set: (postData: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
  type: T
}
