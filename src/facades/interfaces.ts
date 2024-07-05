import type {
  AreaModelAny,
  BuildingModel,
  DeviceModel,
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
  FanSpeed,
  FrostProtectionData,
  GetDeviceData,
  HolidayModeData,
  Horizontal,
  ListDevice,
  OperationMode,
  SetAtaGroupPostData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  Values,
  Vertical,
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
  getTiles: ((select?: false | null) => Promise<TilesData<null>>) &
    (<U extends keyof typeof DeviceType>(
      select: DeviceModel<U>,
    ) => Promise<TilesData<U>>)
  getWifiReport: (hour?: number) => Promise<WifiData>
  id: number
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
  setAta: ({
    fan,
    horizontal,
    operationMode,
    power,
    temperature,
    vertical,
  }: {
    fan?: Exclude<FanSpeed, FanSpeed.silent>
    horizontal?: Horizontal
    operationMode?: OperationMode
    power?: boolean
    temperature?: number
    vertical?: Vertical
  }) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade extends IBaseSuperDeviceFacade {
  actualData: () => Promise<BuildingData>
  data: BuildingSettings
  fetch: () => Promise<BuildingSettings>
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade<DeviceModelAny> {
  data: ListDevice[T]['Device']
  fetch: () => Promise<ListDevice[T]['Device']>
  flags: Record<keyof UpdateDeviceData[T], number>
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: ({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }) => Promise<EnergyData[T]>
  getTiles: ((select?: false | null) => Promise<TilesData<null>>) &
    ((select: true | DeviceModel<T>) => Promise<TilesData<T>>)
  set: (data: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
  type: T
  values: Values[T]
}
