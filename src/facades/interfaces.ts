import type { DeviceType } from '../enums.js'
import type {
  IBaseBuildingModel,
  IBaseDeviceModel,
  IDeviceModel,
  IDeviceModelAny,
  IModel,
} from '../models/interfaces.js'
import type {
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
  WifiData,
  ZoneSettings,
} from '../types/index.js'

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

export interface FrostProtectionQuery {
  readonly max: number
  readonly min: number
  readonly enabled?: boolean
}

export interface HolidayModeQuery {
  readonly days?: number
  readonly from?: string
  readonly to?: string | null
}

export interface IFacade extends IModel {
  devices: IDeviceModelAny[]
  getErrors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  getTiles: ((select?: false) => Promise<TilesData<null>>) &
    (<U extends keyof typeof DeviceType>(
      select: IDeviceModel<U>,
    ) => Promise<TilesData<U>>)
  getWifiReport: (hour?: number) => Promise<WifiData>
  onSync: (params?: { type?: keyof typeof DeviceType }) => Promise<void>
  setFrostProtection: (
    query: FrostProtectionQuery,
  ) => Promise<FailureData | SuccessData>
  setHolidayMode: (
    query: HolidayModeQuery,
  ) => Promise<FailureData | SuccessData>
  setPower: (power?: boolean) => Promise<boolean>
}

export interface ISuperDeviceFacade extends IFacade {
  getAta: () => Promise<GroupAtaState>
  setAta: (state: GroupAtaState) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade
  extends IBaseBuildingModel,
    ISuperDeviceFacade {
  fetch: () => Promise<ZoneSettings>
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseDeviceModel<T>,
    IFacade {
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
  getTiles: ((select: true | IDeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  set: (data: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
}

export type IDeviceFacadeAny =
  | IDeviceFacade<'Ata'>
  | IDeviceFacade<'Atw'>
  | IDeviceFacade<'Erv'>
