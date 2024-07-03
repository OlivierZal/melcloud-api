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
import type { DeviceModel } from '../models'

export interface IBaseFacade {
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
    (<T extends keyof typeof DeviceType>(
      select: DeviceModel<T>,
    ) => Promise<TilesData<T>>)
  getWifiReport: (hour?: number) => Promise<WifiData>
  id: number
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

export interface IBaseSuperDeviceFacade extends IBaseFacade {
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
  fetch: () => Promise<BuildingSettings>
  settings: BuildingSettings
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade {
  data: ListDevice[T]['Device']
  fetch: () => Promise<ListDevice[T]['Device']>
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
  values: Values[T]
}
