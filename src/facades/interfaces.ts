import type { DeviceModel } from '../models'
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

export interface IBaseFacade {
  getErrors: ({
    from,
    to,
  }: {
    from?: string
    to?: string
  }) => Promise<ErrorData[] | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  getTiles: ((select?: false) => Promise<TilesData<null>>) &
    (<U extends keyof typeof DeviceType>(
      select: DeviceModel<U>,
    ) => Promise<TilesData<U>>)
  getWifiReport: (hour?: number) => Promise<WifiData>
  id: number
  name: string
  setFrostProtection: ({
    enabled,
    max,
    min,
  }: {
    enabled?: boolean
    max: number
    min: number
  }) => Promise<FailureData | SuccessData>
  setHolidayMode: (({
    enabled,
    from,
    to,
  }: {
    enabled?: true
    from?: string
    to: string
  }) => Promise<FailureData | SuccessData>) &
    (({
      enabled,
      from,
      days,
    }: {
      enabled?: true
      from?: string
      days: number
    }) => Promise<FailureData | SuccessData>) &
    (({ enabled }: { enabled: false }) => Promise<FailureData | SuccessData>)
  setPower: (enabled?: boolean) => Promise<boolean>
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
  data: BuildingSettings
  fetch: () => Promise<BuildingSettings>
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade {
  data: ListDevice[T]['Device']
  fetch: () => Promise<ListDevice[T]['Device']>
  flags: Record<keyof UpdateDeviceData[T], number>
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: ({
    from,
    to,
  }: {
    from?: string
    to?: string
  }) => Promise<EnergyData[T]>
  getTiles: ((select: true | DeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  set: (data: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
  type: T
  values: Values[T]
}
