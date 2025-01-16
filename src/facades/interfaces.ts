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
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  ZoneSettings,
} from '../types/common.ts'

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
  readonly fetch: () => Promise<ZoneSettings>
}

export interface IDeviceFacade<T extends DeviceType>
  extends IBaseDeviceModel<T>,
    IFacade {
  readonly flags: Record<keyof UpdateDeviceData<T>, number>
  readonly fetch: () => Promise<ListDeviceData<T>>
  readonly operationModes: (
    query: ReportQuery,
  ) => Promise<ReportChartPieOptions>
  readonly setValues: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>
  readonly temperatures: (query: ReportQuery) => Promise<ReportChartLineOptions>
  readonly tiles: ((select: true | IDeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  readonly values: () => Promise<GetDeviceData<T>>
  // DeviceType.Ata | DeviceType.Atw
  readonly energy: (query: ReportQuery) => Promise<EnergyData<T>>
  // DeviceType.Atw
  readonly hourlyTemperatures: (
    hour?: HourNumbers,
  ) => Promise<ReportChartLineOptions>
  readonly internalTemperatures: (
    query: ReportQuery,
  ) => Promise<ReportChartLineOptions>
}

export interface IFacade extends IModel {
  readonly devices: readonly IDeviceModelAny[]
  readonly errors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  readonly frostProtection: () => Promise<FrostProtectionData>
  readonly holidayMode: () => Promise<HolidayModeData>
  readonly onSync: (params?: { type?: DeviceType }) => Promise<void>
  readonly setFrostProtection: (
    query: FrostProtectionQuery,
  ) => Promise<FailureData | SuccessData>
  readonly setHolidayMode: (
    query: HolidayModeQuery,
  ) => Promise<FailureData | SuccessData>
  readonly setPower: (value?: boolean) => Promise<boolean>
  readonly signal: (hour?: HourNumbers) => Promise<ReportChartLineOptions>
  readonly tiles: ((select?: false) => Promise<TilesData<null>>) &
    (<T extends DeviceType>(select: IDeviceModel<T>) => Promise<TilesData<T>>)
}

export interface IFacadeManager {
  readonly get: (instance?: IModel) => IFacade | null
}

export interface ISuperDeviceFacade extends IFacade {
  readonly group: () => Promise<GroupState>
  readonly setGroup: (state: GroupState) => Promise<FailureData | SuccessData>
}

export interface ReportChartLineOptions extends ReportChartOptions {
  readonly series: readonly {
    readonly data: (number | null)[]
    readonly name: string
  }[]
  readonly unit: string
}

export interface ReportChartOptions {
  readonly from: string
  readonly labels: readonly string[]
  readonly to: string
}

export interface ReportChartPieOptions extends ReportChartOptions {
  readonly series: number[]
}

export interface ReportQuery {
  readonly from?: string
  readonly to?: string
}

export type IDeviceFacadeAny =
  | IDeviceFacade<DeviceType.Ata>
  | IDeviceFacade<DeviceType.Atw>
  | IDeviceFacade<DeviceType.Erv>
