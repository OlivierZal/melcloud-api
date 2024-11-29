import type { HourNumbers } from 'luxon'

import type { DeviceType } from '../enums.ts'
import type {
  IBaseBuildingModel,
  IBaseDeviceModel,
  IDeviceModel,
  IDeviceModelAny,
  IModel,
} from '../models/interfaces.ts'
import type { ErrorLog, ErrorLogQuery } from '../services/interfaces.ts'
import type { GroupState } from '../types/ata.ts'
import type {
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  HolidayModeData,
  ListDeviceData,
  OperationModeLogData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  ZoneSettings,
} from '../types/common.ts'

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
  fetch: () => Promise<ListDeviceData<T>>
  flags: Record<keyof UpdateDeviceData<T>, number>
  operationModes: (query: ReportQuery) => Promise<OperationModeLogData>
  setValues: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>
  temperatures: (query: ReportQuery) => Promise<ReportChartOptions>
  tiles: ((select: true | IDeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  values: () => Promise<GetDeviceData<T>>
  // DeviceType.Ata | DeviceType.Atw
  energy: (query: ReportQuery) => Promise<EnergyData<T>>
  // DeviceType.Atw
  hourlyTemperature: (hour?: HourNumbers) => Promise<ReportChartOptions>
  internalTemperatures: (query: ReportQuery) => Promise<ReportChartOptions>
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
  signal: (hour?: HourNumbers) => Promise<ReportChartOptions>
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

export interface ReportChartOptions {
  from: string
  labels: readonly string[]
  series: {
    data: (number | null)[]
    name: string
  }[]
  to: string
}

export interface ReportQuery {
  from?: string
  to?: string
}

export type IDeviceFacadeAny =
  | IDeviceFacade<DeviceType.Ata>
  | IDeviceFacade<DeviceType.Atw>
  | IDeviceFacade<DeviceType.Erv>
