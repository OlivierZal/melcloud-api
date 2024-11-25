import type { HourNumbers } from 'luxon'

import type { DeviceType } from '../enums.js'
import type {
  IBaseBuildingModel,
  IBaseDeviceModel,
  IDeviceModel,
  IDeviceModelAny,
  IModel,
} from '../models/interfaces.js'
import type { ErrorLog, ErrorLogQuery } from '../services/interfaces.js'
import type { GroupState } from '../types/ata.js'
import type {
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  HolidayModeData,
  ListDeviceData,
  OperationModeLogData,
  ReportData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  ZoneSettings,
} from '../types/common.js'

interface IFacadeWithEnergy<T extends DeviceType> extends IBaseDeviceFacade<T> {
  energy: (query: ReportQuery) => Promise<EnergyData<T>>
}

export interface FrostProtectionQuery {
  max: number
  min: number
  enabled?: boolean
}

export interface HolidayModeQuery {
  from?: string
  to?: string
}

export interface IBaseDeviceFacade<T extends DeviceType>
  extends IBaseDeviceModel<T>,
    IFacade {
  fetch: () => Promise<ListDeviceData<T>>
  flags: Record<keyof UpdateDeviceData<T>, number>
  operationModes: (query: ReportQuery) => Promise<OperationModeLogData>
  setValues: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>
  temperatures: (query: ReportQuery) => Promise<ReportData>
  tiles: ((select: true | IDeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  values: () => Promise<GetDeviceData<T>>
}

export interface IBuildingFacade
  extends IBaseBuildingModel,
    ISuperDeviceFacade {
  fetch: () => Promise<ZoneSettings>
}

export interface IDeviceFacadeAta
  extends IBaseDeviceFacade<DeviceType.Ata>,
    IFacadeWithEnergy<DeviceType.Ata> {}

export interface IDeviceFacadeAtw
  extends IBaseDeviceFacade<DeviceType.Atw>,
    IFacadeWithEnergy<DeviceType.Atw> {
  hourlyTemperature: (hour?: HourNumbers) => Promise<ReportData>
  internalTemperatures: (query: ReportQuery) => Promise<ReportData>
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
  signal: (hour?: HourNumbers) => Promise<ReportData>
  tiles: ((select?: false) => Promise<TilesData<null>>) &
    (<U extends DeviceType>(select: IDeviceModel<U>) => Promise<TilesData<U>>)
}

export interface IFacadeManager {
  get: (instance?: IModel) => IFacade | undefined
}

export interface ISuperDeviceFacade extends IFacade {
  group: () => Promise<GroupState>
  setGroup: (state: GroupState) => Promise<FailureData | SuccessData>
}

export interface ReportQuery {
  from?: string
  to?: string
}

export type IDeviceFacade<T extends DeviceType> =
  T extends DeviceType.Ata ? IDeviceFacadeAta
  : T extends DeviceType.Atw ? IDeviceFacadeAtw
  : T extends DeviceType.Erv ? IDeviceFacadeErv
  : never

export type IDeviceFacadeAny =
  | IDeviceFacade<DeviceType.Ata>
  | IDeviceFacade<DeviceType.Atw>
  | IDeviceFacade<DeviceType.Erv>

export type IDeviceFacadeErv = IBaseDeviceFacade<DeviceType.Erv>
