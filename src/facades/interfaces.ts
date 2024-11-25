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
  GroupState,
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
  energy: ({
    from,
    to,
  }: {
    from?: string
    to?: string
  }) => Promise<EnergyData<T>>
  fetch: () => Promise<ListDeviceData<T>>
  flags: Record<keyof UpdateDeviceData<T>, number>
  setValues: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>
  tiles: ((select: true | IDeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  values: () => Promise<GetDeviceData<T>>
}

export interface IFacade extends IModel {
  devices: IDeviceModelAny[]
  errors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  frostProtection: () => Promise<FrostProtectionData>
  holidayMode: () => Promise<HolidayModeData>
  onSync: (params?: { type?: DeviceType }) => Promise<void>
  setFrostProtection: (
    query: FrostProtectionQuery,
  ) => Promise<FailureData | SuccessData>
  setHolidayMode: (
    query: HolidayModeQuery,
  ) => Promise<FailureData | SuccessData>
  setPower: (value?: boolean) => Promise<boolean>
  tiles: ((select?: false) => Promise<TilesData<null>>) &
    (<U extends DeviceType>(select: IDeviceModel<U>) => Promise<TilesData<U>>)
  wifi: (hour?: number) => Promise<ReportData>
}

export interface IFacadeManager {
  get: (instance?: IModel) => IFacade | undefined
}

export interface ISuperDeviceFacade extends IFacade {
  group: () => Promise<GroupState>
  setGroup: (state: GroupState) => Promise<FailureData | SuccessData>
}

export type IDeviceFacadeAny =
  | IDeviceFacade<DeviceType.Ata>
  | IDeviceFacade<DeviceType.Atw>
  | IDeviceFacade<DeviceType.Erv>
