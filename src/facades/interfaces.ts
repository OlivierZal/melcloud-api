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
import type {
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  GroupState,
  HolidayModeData,
  ListDeviceData,
  OperationModeLogData,
  ReportData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  ZoneSettings,
} from '../types/index.js'

export interface FrostProtectionQuery {
  max: number
  min: number
  enabled?: boolean
}

export interface HolidayModeQuery {
  from?: string
  to?: string
}

export interface IBuildingFacade
  extends IBaseBuildingModel,
    ISuperDeviceFacade {
  fetch: () => Promise<ZoneSettings>
}

export interface IDeviceFacade<T extends DeviceType>
  extends IBaseDeviceModel<T>,
    IFacade {
  energy: (query: ReportQuery) => Promise<EnergyData<T>>
  fetch: () => Promise<ListDeviceData<T>>
  flags: Record<keyof UpdateDeviceData<T>, number>
  hourlyTemperature: (hour?: HourNumbers) => Promise<ReportData>
  internalTemperatures: (query: ReportQuery) => Promise<ReportData>
  operationModeLog: (query: ReportQuery) => Promise<OperationModeLogData>
  setValues: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>
  temperatureLog: (query: ReportQuery) => Promise<ReportData>
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

export type IDeviceFacadeAny =
  | IDeviceFacade<DeviceType.Ata>
  | IDeviceFacade<DeviceType.Atw>
  | IDeviceFacade<DeviceType.Erv>
