import type { DeviceModel } from '../models'
import type {
  BuildingData,
  BuildingSettings,
  DeviceType,
  EnergyData,
  ErrorData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  GroupAtaState,
  HolidayModeData,
  ListDevice,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  Values,
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
    days,
    enabled,
    from,
  }: {
    enabled?: true
    from?: string
    days: number
  }) => Promise<FailureData | SuccessData>) &
    /* eslint-disable perfectionist/sort-intersection-types */
    (({
      enabled,
      from,
      to,
    }: {
      enabled?: true
      from?: string
      to: string
    }) => Promise<FailureData | SuccessData>) &
    /* eslint-enable perfectionist/sort-intersection-types */
    (({ enabled }: { enabled: false }) => Promise<FailureData | SuccessData>)
  setPower: (enabled?: boolean) => Promise<boolean>
}

export interface IBaseSuperDeviceFacade extends IBaseFacade {
  getAta: () => Promise<GroupAtaState>
  setAta: (state: GroupAtaState) => Promise<FailureData | SuccessData>
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
