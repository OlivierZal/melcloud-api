import type { DeviceModel, DeviceModelAny } from '../models'
import type {
  DeviceType,
  EnergyData,
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
  ZoneSettings,
} from '../types'

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}

export interface ErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}

export interface ErrorLog {
  readonly errors: ErrorDetails[]
  readonly fromDateHuman: string
  readonly nextFromDate: string
  readonly nextToDate: string
}

export interface IBaseFacade {
  devices: DeviceModelAny[]
  getErrors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
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
    max: number
    min: number
    enabled?: boolean
  }) => Promise<FailureData | SuccessData>
  setHolidayMode: (({
    days,
    from,
  }: {
    days: number
    from?: string
  }) => Promise<FailureData | SuccessData>) &
    (({
      from,
      to,
    }: {
      to: string | null
      from?: string
    }) => Promise<FailureData | SuccessData>)
  setPower: (enabled?: boolean) => Promise<boolean>
}

export interface IBaseSuperDeviceFacade extends IBaseFacade {
  getAta: () => Promise<GroupAtaState>
  setAta: (state: GroupAtaState) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade extends IBaseSuperDeviceFacade {
  data: ZoneSettings
  fetch: () => Promise<ZoneSettings>
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
