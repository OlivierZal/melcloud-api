import type { DeviceType } from '../enums.js'
import type {
  IBaseBuildingModel,
  IBaseDeviceModel,
  IDeviceModel,
  IDeviceModelAny,
  IModel,
} from '../models/interfaces.js'
import type { ErrorLog, ErrorLogQuery } from '../services/interfaces.js'
import type {
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  GroupAtaState,
  HolidayModeData,
  ListDeviceData,
  ReportData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  ZoneSettings,
} from '../types/index.js'

export interface FrostProtectionQuery {
  readonly max: number
  readonly min: number
  readonly enabled?: boolean
}

export interface HolidayModeQuery {
  readonly from?: string
  readonly to?: string
}

export interface IBuildingFacade
  extends IBaseBuildingModel,
    ISuperDeviceFacade {
  fetch: () => Promise<ZoneSettings>
}

export interface IDeviceFacade<T extends DeviceType>
  extends IBaseDeviceModel<T>,
    IFacade {
  fetch: () => Promise<ListDeviceData<T>>
  flags: Record<keyof UpdateDeviceData<T>, number>
  get: () => Promise<GetDeviceData<T>>
  getEnergyReport: ({
    from,
    to,
  }: {
    from?: string
    to?: string
  }) => Promise<EnergyData<T>>
  getTiles: ((select: true | IDeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  set: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>
}

export interface IFacade extends IModel {
  devices: IDeviceModelAny[]
  getErrors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  getTiles: ((select?: false) => Promise<TilesData<null>>) &
    (<U extends DeviceType>(select: IDeviceModel<U>) => Promise<TilesData<U>>)
  getWifiReport: (hour?: number) => Promise<ReportData>
  onSync: (params?: { type?: DeviceType }) => Promise<void>
  setFrostProtection: (
    query: FrostProtectionQuery,
  ) => Promise<FailureData | SuccessData>
  setHolidayMode: (
    query: HolidayModeQuery,
  ) => Promise<FailureData | SuccessData>
  setPower: (power?: boolean) => Promise<boolean>
}

export interface IFacadeManager {
  get: (instance?: IModel) => IFacade | undefined
}

export interface ISuperDeviceFacade extends IFacade {
  getAta: () => Promise<GroupAtaState>
  setAta: (state: GroupAtaState) => Promise<FailureData | SuccessData>
}

export type IDeviceFacadeAny =
  | IDeviceFacade<DeviceType.Ata>
  | IDeviceFacade<DeviceType.Atw>
  | IDeviceFacade<DeviceType.Erv>
